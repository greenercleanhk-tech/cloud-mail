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
import attService from '../service/att-service';
import emailService from '../service/email-service';
import settingService from '../service/setting-service';
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
     * 自動拆分子任務並分配到各帳號
     * contactGroupIds: 數組，如 [1, 2, 3]
     */
    async create(c, params, userId) {
        const { name, domainId, templateId, contactGroupIds, totalRecipients, scheduledAt } = params;

        if (!name || !domainId || !templateId || !contactGroupIds || !totalRecipients || !scheduledAt) {
            throw new BizError(t('scheduleFieldRequired'));
        }

        // 解析通訊組（支持新格式數組或舊格式單值）
        let groupIdArr = [];
        if (Array.isArray(contactGroupIds)) {
            groupIdArr = contactGroupIds.map(Number);
        } else if (typeof contactGroupIds === 'string') {
            try { groupIdArr = JSON.parse(contactGroupIds).map(Number); } catch { groupIdArr = [Number(contactGroupIds)]; }
        } else {
            groupIdArr = [Number(contactGroupIds)];
        }

        // 驗證模板存在
        const template = await orm(c)
            .select()
            .from(emailTemplate)
            .where(and(
                eq(emailTemplate.templateId, Number(templateId)),
                eq(emailTemplate.isDel, 0)
            ))
            .get();
        if (!template) throw new BizError(t('templateNotFound'));

        // 驗證所有通訊組存在
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

        // 獲取該域名下所有帳號
        const accounts = await orm(c)
            .select()
            .from(account)
            .where(and(
                eq(account.domainId, Number(domainId)),
                eq(account.isDel, 0)
            ))
            .all();

        if (accounts.length === 0) {
            throw new BizError(t('noAccountInDomain'));
        }

        // 創建 job，contactGroupId 存為 JSON 數組字串
        const job = await orm(c)
            .insert(scheduleJob)
            .values({
                name,
                domainId: Number(domainId),
                templateId: Number(templateId),
                contactGroupId: JSON.stringify(groupIdArr),
                totalRecipients: Number(totalRecipients),
                status: 'pending',
                scheduledAt,
                userId
            })
            .returning()
            .get();

        // 平均分配：總人數 / 帳號數 = 每帳號多少人
        const perAccount = Math.ceil(Number(totalRecipients) / accounts.length);

        // 創建子任務
        let start = 0;
        for (const acc of accounts) {
            const end = Math.min(start + perAccount - 1, Number(totalRecipients) - 1);
            if (start > Number(totalRecipients) - 1) break;

            await orm(c)
                .insert(scheduleTask)
                .values({
                    jobId: job.jobId,
                    accountId: acc.accountId,
                    recipientStart: start,
                    recipientEnd: end,
                    sentCount: 0,
                    failedCount: 0,
                    status: 'pending',
                    scheduledAt
                })
                .run();

            start = end + 1;
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

        // 找出所有待發送的子任務（計劃時間已到且未開始的）
        const pendingTasks = await orm(c)
            .select({
                task: scheduleTask,
                job: scheduleJob
            })
            .from(scheduleTask)
            .leftJoin(scheduleJob, eq(scheduleTask.jobId, scheduleJob.jobId))
            .where(and(
                eq(scheduleTask.status, 'pending'),
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
     * 執行單個子任務：向該帳號的收件人範圍發送郵件
     */
    async runTask(c, task, job) {
        // 更新子任務狀態為 running
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

        // 解析多個通訊組 ID（contactGroupId 存為 JSON 數組）
        let groupIdArr = [];
        try {
            const raw = job.contactGroupId;
            if (Array.isArray(raw)) {
                groupIdArr = raw;
            } else if (typeof raw === 'string') {
                groupIdArr = JSON.parse(raw);
            } else {
                groupIdArr = [raw];
            }
        } catch { groupIdArr = [job.contactGroupId]; }

        // 查所有組的聯繫人（只取這段範圍內的，同時過濾已退訂者）
        const contacts = await orm(c)
            .select()
            .from(contact)
            .where(and(
                inArray(contact.groupId, groupIdArr),
                eq(contact.isDel, 0),
                eq(contact.isUnsubscribed, 0)
            ))
            .orderBy(contact.contactId)
            .offset(task.recipientStart)
            .limit(task.recipientEnd - task.recipientStart + 1)
            .all();

        // 查發件帳號
        const accountRow = await orm(c)
            .select()
            .from(account)
            .where(eq(account.accountId, task.accountId))
            .get();

        if (!accountRow || !template || contacts.length === 0) {
            await orm(c)
                .update(scheduleTask)
                .set({ status: 'completed', finishedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') })
                .where(eq(scheduleTask.taskId, task.taskId))
                .run();
            return;
        }

        const { resendTokens } = await settingService.query(c);
        const resendToken = resendTokens[accountRow.email.split('@')[1]];

        let sent = 0;
        let failed = 0;

        for (const con of contacts) {
            try {
                // 自動追加退訂連結（Base64 編碼 email 作為 token）
                const token = Buffer.from(con.email).toString('base64');
                const unsubLink = `${c.env.KV_URL || 'https://' + accountRow.email.split('@')[1]}/unsubscribe?token=${token}`;
                const unsubHtml = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
                    <a href="${unsubLink}" style="color:#999;text-decoration:underline;">退訂電子報</a>
                </div>`;
                const htmlWithUnsub = template.content + unsubHtml;

                await emailService.sendByResend(resendToken, {
                    name: template.name,
                    accountEmail: accountRow.email,
                    receiveEmail: [con.email],
                    subject: template.subject,
                    text: '',
                    html: htmlWithUnsub,
                    attachments: []
                });
                sent++;

                // 間隔防限流
                await new Promise(r => setTimeout(r, this.SEND_INTERVAL_MS));
            } catch (e) {
                failed++;
                console.error('[schedule] send failed:', con.email, e.message);
            }
        }

        // 更新子任務
        await orm(c)
            .update(scheduleTask)
            .set({
                sentCount: sent,
                failedCount: failed,
                status: 'completed',
                finishedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
            })
            .where(eq(scheduleTask.taskId, task.taskId))
            .run();

        // 更新 job 進度
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
