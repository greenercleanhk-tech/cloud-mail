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

        // 獲取並亂序聯絡人（一次）
        const contacts = await orm(c)
            .select({ contactId: contact.contactId })
            .from(contact)
            .where(and(
                inArray(contact.groupId, groupIdArr),
                eq(contact.isDel, 0),
                eq(contact.isUnsubscribed, 0)
            ))
            .all();

        if (contacts.length === 0) {
            throw new BizError(t('noRecipient'));
        }

        // Fisher-Yates 亂序
        const shuffled = contacts.map(r => r.contactId);
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // 獲取域名下所有帳號並亂序
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

        // 帳號也亂序
        const accountPool = accounts.map(a => a.accountId);
        for (let i = accountPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [accountPool[i], accountPool[j]] = [accountPool[j], accountPool[i]];
        }

        // 創建 job
        const job = await orm(c)
            .insert(scheduleJob)
            .values({
                name,
                domainId: Number(domainId),
                templateId: Number(templateId),
                contactGroupId: JSON.stringify(groupIdArr),
                totalRecipients: shuffled.length,
                shuffledContactIds: JSON.stringify(shuffled),
                status: 'pending',
                scheduledAt,
                userId
            })
            .returning()
            .get();

        // 只有一個 task：使用第一個帳號
        await orm(c)
            .insert(scheduleTask)
            .values({
                jobId: job.jobId,
                accountPool: JSON.stringify(accountPool),
                accountPoolIndex: 0,
                accountId: accountPool[0],
                cursor: 0,
                sentToday: 0,
                lastSentDate: '',
                sentCount: 0,
                failedCount: 0,
                status: 'pending',
                scheduledAt
            })
            .run();

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
                sql`(${scheduleTask.status} = 'pending' OR ${scheduleTask.status} = 'waiting_limit' OR ${scheduleTask.status} = 'waiting_mailbox')`,
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

        // 解析亂序後的聯絡人 ID（從 job 讀）
        let shuffledContactIds = [];
        try {
            shuffledContactIds = JSON.parse(job.shuffledContactIds || '[]');
        } catch { shuffledContactIds = []; }
        if (shuffledContactIds.length === 0) return;

        // 解析帳號池
        let accountPool = [];
        try {
            accountPool = JSON.parse(task.accountPool || '[]');
        } catch { accountPool = []; }
        if (accountPool.length === 0) return;

        // 查域名
        const domainRow = await orm(c)
            .select()
            .from(domain)
            .where(eq(domain.domainId, job.domainId))
            .get();
        if (!domainRow) return;

        const dailyLimit = domainRow.dailyLimit || 500;
        const perMailboxDailyLimit = Math.floor(dailyLimit / accountPool.length);

        // 新的一天：重置域名日計數 + task cursor
        if (task.lastSentDate !== today) {
            await orm(c)
                .update(domain)
                .set({ sentToday: 0, lastSentDate: today })
                .where(eq(domain.domainId, job.domainId))
                .run();
            await orm(c)
                .update(scheduleTask)
                .set({ sentToday: 0, lastSentDate: today, accountPoolIndex: 0, accountId: accountPool[0] })
                .where(eq(scheduleTask.taskId, task.taskId))
                .run();
            // task 變量也要更新
            task.sentToday = 0;
            task.accountPoolIndex = 0;
            task.accountId = accountPool[0];
        }

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
        if (!template) return;

        // 查所有帳號（用於取郵箱地址）
        const accountRows = await orm(c)
            .select()
            .from(account)
            .where(and(
                inArray(account.accountId, accountPool),
                eq(account.isDel, 0),
                eq(account.status, 'active')
            ))
            .all();
        const accountMap = Object.fromEntries(accountRows.map(a => [a.accountId, a]));

        const { resendTokens } = await settingService.query(c);
        const resendToken = domainRow.resendApiKey || resendTokens[domainRow.domain] || '';

        // 各帳號今日已發（記憶體追蹤）
        const mailboxDailySent = {};
        accountPool.forEach(id => mailboxDailySent[id] = 0);

        let cursor = task.cursor || 0;
        let poolIdx = task.accountPoolIndex || 0;
        let sessionSent = 0;
        let sessionFailed = 0;
        let newSentToday = task.sentToday || 0;
        let stopReason = null;

        while (cursor < shuffledContactIds.length) {
            // 檢查域名日限額
            const domainNow = await orm(c)
                .select({ sentToday: domain.sentToday, lastSentDate: domain.lastSentDate })
                .from(domain)
                .where(eq(domain.domainId, job.domainId))
                .get();

            // 新的一天：重置
            if (domainNow.lastSentDate !== today) {
                await orm(c)
                    .update(domain)
                    .set({ sentToday: 0, lastSentDate: today })
                    .where(eq(domain.domainId, job.domainId))
                    .run();
                newSentToday = 0;
                Object.keys(mailboxDailySent).forEach(k => mailboxDailySent[k] = 0);
            }

            if (newSentToday >= dailyLimit) {
                stopReason = 'domain_limit';
                break;
            }

            // 找下一個還有配額的帳號
            let tries = 0;
            while (tries < accountPool.length) {
                const accId = accountPool[poolIdx % accountPool.length];
                if (mailboxDailySent[accId] < perMailboxDailyLimit) {
                    break;
                }
                poolIdx++;
                tries++;
            }

            if (tries >= accountPool.length) {
                // 所有帳號今天的配額都用了
                stopReason = 'mailbox_limit';
                break;
            }

            const accId = accountPool[poolIdx % accountPool.length];
            const accountRow = accountMap[accId];
            if (!accountRow || accountRow.status !== 'active') {
                poolIdx++;
                continue;
            }

            // 取出聯絡人
            const contactRow = await orm(c)
                .select()
                .from(contact)
                .where(and(
                    eq(contact.contactId, shuffledContactIds[cursor]),
                    eq(contact.isDel, 0)
                ))
                .get();

            if (!contactRow || contactRow.isUnsubscribed === 1) {
                cursor++;
                continue;
            }

            try {
                const token = base64Encode(contactRow.email);
                const unsubLink = `https://cloud-mail.lauskiing520.workers.dev/contact/unsubscribe?token=${token}`;
                const unsubHtml = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;line-height:1.8;">
                    如閣下不想再收到我們的電郵，請<a href="${unsubLink}" style="color:#999;text-decoration:underline;">按這裡</a>一鍵回覆退訂。<br/>
                    If you do not wish to receive further email messages from us,<br/>
                    please <a href="${unsubLink}" style="color:#999;text-decoration:underline;">click here</a> to reply and unsubscribe.
                </div>`;

                await emailService.sendByResend(resendToken, {
                    name: template.name,
                    accountEmail: accountRow.email,
                    receiveEmail: [contactRow.email],
                    subject: template.subject,
                    text: '',
                    html: template.content + unsubHtml,
                    attachments: []
                });

                sessionSent++;
                newSentToday++;
                mailboxDailySent[accId]++;
                cursor++;
                poolIdx++;

                // 即時更新域名日計數
                await orm(c)
                    .update(domain)
                    .set({ sentToday: newSentToday })
                    .where(eq(domain.domainId, job.domainId))
                    .run();

                await new Promise(r => setTimeout(r, this.SEND_INTERVAL_MS));
            } catch (e) {
                sessionFailed++;
                cursor++;
                poolIdx++;
                console.error('[schedule] send failed:', contactRow.email, e.message);
            }
        }

        // 判斷任務狀態
        let finalStatus = 'completed';
        if (cursor < shuffledContactIds.length) {
            finalStatus = stopReason === 'domain_limit' ? 'waiting_limit' : 'waiting_mailbox';
        }

        // 儲存進度
        await orm(c)
            .update(scheduleTask)
            .set({
                cursor,
                accountPoolIndex: poolIdx % accountPool.length,
                accountId: accountPool[poolIdx % accountPool.length],
                sentToday: newSentToday,
                lastSentDate: today,
                sentCount: (task.sentCount || 0) + sessionSent,
                failedCount: (task.failedCount || 0) + sessionFailed,
                status: finalStatus,
                finishedAt: finalStatus === 'completed' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null
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
