/**
 * schedule-service.js - 排程任務業務邏輯
 */
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { scheduleJob } from '../entity/schedule-job';
import { scheduleTask } from '../entity/schedule-task';
import { emailTemplate } from '../entity/email-template';
import { contact } from '../entity/contact';
import { contactGroup } from '../entity/contact';
import { account } from '../entity/account';
import { email } from '../entity/email';
import { domain } from '../entity/domain';
import attService from '../service/att-service';
import emailService from '../service/email-service';
import settingService from '../service/setting-service';
import domainService from '../service/domain-service';
import { base64Encode } from '../utils/crypto-utils';
import { eq, and, desc, inArray, count, lt, gte } from 'drizzle-orm';
import { t } from '../i18n/i18n';
import dayjs from 'dayjs';

const scheduleService = {

    // 每帳號每日上限（可配置）
    ACCOUNT_DAILY_LIMIT: 500,

    // 每封間隔（秒）
    SEND_INTERVAL_MS: 2000,

    /**
     * 列出所有排程任務（管理員視角）
     */
    async list(c, params = {}) {
        const { status, domainId } = params;

        const conditions = [eq(scheduleJob.isDel, 0)];
        if (status) conditions.push(eq(scheduleJob.status, status));
        if (domainId) conditions.push(eq(scheduleJob.domainId, Number(domainId)));

        const list = await orm(c)
            .select()
            .from(scheduleJob)
            .where(conditions.length > 1 ? and(...conditions) : conditions[0])
            .orderBy(desc(scheduleJob.createTime))
            .all();

        return list;
    },

    /**
     * 根據 jobId 獲取任務詳情（含子任務）
     */
    async getById(c, jobId) {
        const job = await orm(c)
            .select()
            .from(scheduleJob)
            .where(and(
                eq(scheduleJob.jobId, Number(jobId)),
                eq(scheduleJob.isDel, 0)
            ))
            .get();

        if (!job) return null;

        const tasks = await orm(c)
            .select()
            .from(scheduleTask)
            .where(eq(scheduleTask.jobId, Number(jobId)))
            .all();

        return { ...job, tasks };
    },

    /**
     * 創建排程任務
     * 自動統計通訊組人數，用 cursor 方式追蹤進度
     * contactGroupIds: 數組，如 [1, 2, 3]
     */
    async create(c, params, userId) {
        const { name, domainId, templateId, contactGroupIds, scheduledAt } = params;

        if (!name || !domainId || !templateId || !contactGroupIds || !scheduledAt) {
            throw new BizError(t('scheduleFieldRequired'));
        }

        // 解析通訊組
        let groupIdArr = [];
        if (Array.isArray(contactGroupIds)) {
            groupIdArr = contactGroupIds.map(Number);
        } else if (typeof contactGroupIds === 'string') {
            try { groupIdArr = JSON.parse(contactGroupIds).map(Number); } catch { groupIdArr = [Number(contactGroupIds)]; }
        } else {
            groupIdArr = [Number(contactGroupIds)];
        }

        // 驗證模板
        const template = await orm(c)
            .select()
            .from(emailTemplate)
            .where(and(
                eq(emailTemplate.templateId, Number(templateId)),
                eq(emailTemplate.isDel, 0)
            ))
            .get();
        if (!template) throw new BizError(t('templateNotFound'));

        // 驗證通訊組
        const groups = await orm(c)
            .select({ groupId: contactGroup.groupId })
            .from(contactGroup)
            .where(and(
                inArray(contactGroup.groupId, groupIdArr),
                eq(contactGroup.isDel, 0)
            ))
            .all();
        if (groups.length !== groupIdArr.length) {
            throw new BizError(t('contactGroupNotFound'));
        }

        // 自動統計人數（排除已退訂、已刪除）
        const countResult = await orm(c)
            .select({ total: count() })
            .from(contact)
            .where(and(
                inArray(contact.groupId, groupIdArr),
                eq(contact.isDel, 0),
                eq(contact.isUnsubscribed, 0)
            ))
            .get();
        const totalRecipients = countResult?.total ?? 0;

        if (totalRecipients === 0) {
            throw new BizError(t('noRecipient'));
        }

        // 獲取域名下所有帳號
        const accounts = await orm(c)
            .select()
            .from(account)
            .where(and(
                eq(account.domainId, Number(domainId)),
                eq(account.isDel, 0),
                eq(account.status, 'active')
            ))
            .all();

        if (accounts.length === 0) {
            throw new BizError(t('noAccountInDomain'));
        }

        // 創建 job
        const job = await orm(c)
            .insert(scheduleJob)
            .values({
                name,
                domainId: Number(domainId),
                templateId: Number(templateId),
                contactGroupId: JSON.stringify(groupIdArr),
                totalRecipients,
                status: 'pending',
                scheduledAt,
                userId
            })
            .returning()
            .get();

        // 每個帳號一個 task（用 cursor 而非固定範圍）
        for (const acc of accounts) {
            await orm(c)
                .insert(scheduleTask)
                .values({
                    jobId: job.jobId,
                    accountId: acc.accountId,
                    recipientStart: 0,
                    recipientEnd: 0,
                    sentCount: 0,
                    failedCount: 0,
                    status: 'pending',
                    scheduledAt,
                    lastContactId: 0,
                    sentToday: 0,
                    lastSentDate: ''
                })
                .run();
        }

        return job;
    },

    /**
     * 取消任務
     */
    async cancel(c, jobId) {
        await orm(c)
            .update(scheduleJob)
            .set({ status: 'cancelled' })
            .where(and(
                eq(scheduleJob.jobId, Number(jobId)),
                eq(scheduleJob.isDel, 0)
            ))
            .run();

        await orm(c)
            .update(scheduleTask)
            .set({ status: 'cancelled' })
            .where(eq(scheduleTask.jobId, Number(jobId)))
            .run();
    },

    /**
     * Cron 觸發：處理到期的排程任務
     */
    async processScheduledJobs(c) {
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const today = dayjs().format('YYYY-MM-DD');

        // 找出所有待發送的子任務（pending 或 waiting_limit 且計劃時間已到）
        const pendingTasks = await orm(c)
            .select({
                task: scheduleTask,
                job: scheduleJob
            })
            .from(scheduleTask)
            .leftJoin(scheduleJob, eq(scheduleTask.jobId, scheduleJob.jobId))
            .where(and(
                sql`(${scheduleTask.status} = 'pending' OR ${scheduleTask.status} = 'waiting_limit')`,
                lte(scheduleTask.scheduledAt, now),
                eq(scheduleJob.status, 'running')
            ))
            .all();

        for (const { task, job } of pendingTasks) {
            if (!job || !task) continue;
            await this.runTask(c, task, job);
        }

        // 啟動新到期的 job（從 pending 改為 running）
        const pendingJobs = await orm(c)
            .select()
            .from(scheduleJob)
            .where(and(
                eq(scheduleJob.status, 'pending'),
                lte(scheduleJob.scheduledAt, now),
                eq(scheduleJob.isDel, 0)
            ))
            .all();

        for (const job of pendingJobs) {
            await orm(c)
                .update(scheduleJob)
                .set({ status: 'running' })
                .where(eq(scheduleJob.jobId, job.jobId))
                .run();

            await orm(c)
                .update(scheduleTask)
                .set({ status: 'pending' })
                .where(eq(scheduleTask.jobId, job.jobId))
                .run();
        }

        // 檢查已完成：所有子任務都完成或取消的 job
        await this.checkJobCompletion(c);
    },

    /**
     * 執行單個子任務（cursor 方式，支援跨日繼續 + 域名日限額）
     */
    async runTask(c, task, job) {
        const today = dayjs().format('YYYY-MM-DD');

        // 查域名（含 dailyLimit）
        const domainRow = await orm(c)
            .select()
            .from(domain)
            .where(eq(domain.domainId, job.domainId))
            .get();

        if (!domainRow) return;

        const dailyLimit = domainRow.dailyLimit || 500;

        // 重置域名日計數（新一天）
        if (domainRow.lastSentDate !== today) {
            await orm(c)
                .update(domain)
                .set({ sentToday: 0, lastSentDate: today })
                .where(eq(domain.domainId, job.domainId))
                .run();
        }

        // 重置帳號日計數（新一天）
        let sentToday = task.sentToday || 0;
        if (task.lastSentDate !== today) {
            sentToday = 0;
            await orm(c)
                .update(scheduleTask)
                .set({ sentToday: 0, lastSentDate: today })
                .where(eq(scheduleTask.taskId, task.taskId))
                .run();
        }

        // 更新任務為 running
        await orm(c)
            .update(scheduleTask)
            .set({ status: 'running' })
            .where(eq(scheduleTask.taskId, task.taskId))
            .run();

        // 查模板
        const template = await orm(c)
            .select()
            .from(emailTemplate)
            .where(eq(emailTemplate.templateId, job.templateId))
            .get();

        // 解析通訊組
        let groupIdArr = [];
        try {
            const raw = job.contactGroupId;
            if (Array.isArray(raw)) groupIdArr = raw;
            else if (typeof raw === 'string') groupIdArr = JSON.parse(raw);
            else groupIdArr = [raw];
        } catch { groupIdArr = [job.contactGroupId]; }

        // 查發件帳號
        const accountRow = await orm(c)
            .select()
            .from(account)
            .where(eq(account.accountId, task.accountId))
            .get();

        if (!accountRow || accountRow.status !== 'active' || !template) {
            await orm(c)
                .update(scheduleTask)
                .set({ status: 'completed', finishedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') })
                .where(eq(scheduleTask.taskId, task.taskId))
                .run();
            return;
        }

        const { resendTokens } = await settingService.query(c);
        const domainName = accountRow.email.split('@')[1];
        const resendToken = (domainRow && domainRow.resendApiKey) ? domainRow.resendApiKey : resendTokens[domainName];

        // === 每次最多取一批（50個），避免一次查太多 ===
        const BATCH_SIZE = 50;
        let lastContactId = task.lastContactId || 0;
        let sessionSent = 0;
        let sessionFailed = 0;
        let hasMore = true;

        while (hasMore) {
            // 1. 檢查域名日限額
            const domainNow = await orm(c)
                .select({ sentToday: domain.sentToday, lastSentDate: domain.lastSentDate })
                .from(domain)
                .where(eq(domain.domainId, job.domainId))
                .get();

            // 新的一天重置
            if (domainNow.lastSentDate !== today) {
                await orm(c)
                    .update(domain)
                    .set({ sentToday: 0, lastSentDate: today })
                    .where(eq(domain.domainId, job.domainId))
                    .run();
            } else if (domainNow.sentToday >= dailyLimit) {
                // 域名日限額已用完，標記 waiting_limit，明天繼續
                await orm(c)
                    .update(scheduleTask)
                    .set({
                        sentToday: sessionSent > 0 ? (task.sentToday + sessionSent) : task.sentToday,
                        lastContactId,
                        lastSentDate: today,
                        status: 'waiting_limit'
                    })
                    .where(eq(scheduleTask.taskId, task.taskId))
                    .run();
                return;
            }

            // 2. 用 cursor 查下一批聯絡人（id > lastContactId）
            const contacts = await orm(c)
                .select()
                .from(contact)
                .where(and(
                    inArray(contact.groupId, groupIdArr),
                    eq(contact.isDel, 0),
                    eq(contact.isUnsubscribed, 0),
                    lastContactId > 0 ? sql`${contact.contactId} > ${lastContactId}` : sql`1=1`
                ))
                .orderBy(contact.contactId)
                .limit(BATCH_SIZE)
                .all();

            if (contacts.length === 0) {
                hasMore = false;
                break;
            }

            for (const con of contacts) {
                // 每發一封，更新域名和任務的 sentToday
                const domainAfter = await orm(c)
                    .select({ sentToday: domain.sentToday })
                    .from(domain)
                    .where(eq(domain.domainId, job.domainId))
                    .get();

                if (domainAfter.sentToday >= dailyLimit) {
                    hasMore = false;
                    // 記錄 cursor，但狀態等下一批
                    await orm(c)
                        .update(scheduleTask)
                        .set({
                            sentToday: (task.sentToday || 0) + sessionSent,
                            lastContactId,
                            lastSentDate: today,
                            status: 'waiting_limit'
                        })
                        .where(eq(scheduleTask.taskId, task.taskId))
                        .run();
                    // 更新域名 sentToday
                    await orm(c)
                        .update(domain)
                        .set({ sentToday: domainAfter.sentToday + sessionSent })
                        .where(eq(domain.domainId, job.domainId))
                        .run();
                    return;
                }

                try {
                    const token = base64Encode(con.email);
                    const unsubLink = `https://cloud-mail.lauskiing520.workers.dev/contact/unsubscribe?token=${token}`;
                    const unsubHtml = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;line-height:1.8;">
                        如閣下不想再收到我們的電郵，請<a href="${unsubLink}" style="color:#999;text-decoration:underline;">按這裡</a>一鍵回覆退訂。<br/>
                        If you do not wish to receive further email messages from us,<br/>
                        please <a href="${unsubLink}" style="color:#999;text-decoration:underline;">click here</a> to reply and unsubscribe.
                    </div>`;

                    await emailService.sendByResend(resendToken, {
                        name: template.name,
                        accountEmail: accountRow.email,
                        receiveEmail: [con.email],
                        subject: template.subject,
                        text: '',
                        html: template.content + unsubHtml,
                        attachments: []
                    });

                    sessionSent++;
                    lastContactId = con.contactId;

                    // 即時更新域名 sentToday + 任務 cursor
                    await orm(c)
                        .update(domain)
                        .set({ sentToday: domainAfter.sentToday + 1 })
                        .where(eq(domain.domainId, job.domainId))
                        .run();

                    await new Promise(r => setTimeout(r, this.SEND_INTERVAL_MS));
                } catch (e) {
                    sessionFailed++;
                    console.error('[schedule] send failed:', con.email, e.message);
                }
            }

            // 如果不到一批，說明發完了
            if (contacts.length < BATCH_SIZE) hasMore = false;
        }

        // 任務完成
        const totalSent = (task.sentCount || 0) + sessionSent;
        const totalFailed = (task.failedCount || 0) + sessionFailed;

        await orm(c)
            .update(scheduleTask)
            .set({
                sentCount: totalSent,
                failedCount: totalFailed,
                sentToday: (task.sentToday || 0) + sessionSent,
                lastContactId,
                lastSentDate: today,
                status: 'completed',
                finishedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
            })
            .where(eq(scheduleTask.taskId, task.taskId))
            .run();

        await this.updateJobProgress(c, job.jobId);
    },

    /**
     * 更新 job 的已完成進度
     */
    async updateJobProgress(c, jobId) {
        const tasks = await orm(c)
            .select()
            .from(scheduleTask)
            .where(eq(scheduleTask.jobId, jobId))
            .all();

        const totalSent = tasks.reduce((sum, t) => sum + (t.sentCount || 0), 0);
        const totalFailed = tasks.reduce((sum, t) => sum + (t.failedCount || 0), 0);

        await orm(c)
            .update(scheduleJob)
            .set({
                sentCount: totalSent,
                failedCount: totalFailed
            })
            .where(eq(scheduleJob.jobId, jobId))
            .run();
    },

    /**
     * 檢查並標記已完成的所有 job
     */
    async checkJobCompletion(c) {
        const runningJobs = await orm(c)
            .select()
            .from(scheduleJob)
            .where(and(
                eq(scheduleJob.status, 'running'),
                eq(scheduleJob.isDel, 0)
            ))
            .all();

        for (const job of runningJobs) {
            const tasks = await orm(c)
                .select()
                .from(scheduleTask)
                .where(eq(scheduleTask.jobId, job.jobId))
                .all();

            const allDone = tasks.every(t => t.status === 'completed' || t.status === 'cancelled');
            if (allDone) {
                await orm(c)
                    .update(scheduleJob)
                    .set({
                        status: 'completed',
                        finishedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
                    })
                    .where(eq(scheduleJob.jobId, job.jobId))
                    .run();
            }
        }
    }
};

export default scheduleService;
