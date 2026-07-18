-- Marketing System Migration: email_template, schedule_job, schedule_task
-- Run this in Cloudflare Dashboard D1 Query Editor or via: npx wrangler d1 execute <db> --remote --file=src/db/migrations/20260718_marketing_system.sql

-- email_template: 郵件模板
CREATE TABLE IF NOT EXISTS email_template (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    domain_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    create_time TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL,
    is_del INTEGER DEFAULT 0 NOT NULL
);

-- schedule_job: 排程任務（一個排程算一個 job）
CREATE TABLE IF NOT EXISTS schedule_job (
    job_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    contact_group_id INTEGER NOT NULL,
    total_recipients INTEGER NOT NULL,
    sent_count INTEGER DEFAULT 0 NOT NULL,
    failed_count INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    scheduled_at TEXT NOT NULL,
    finished_at TEXT,
    user_id INTEGER NOT NULL,
    create_time TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL,
    is_del INTEGER DEFAULT 0 NOT NULL
);

-- schedule_task: 排程子任務（每個帳號一個 task）
CREATE TABLE IF NOT EXISTS schedule_task (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    recipient_start INTEGER NOT NULL,
    recipient_end INTEGER NOT NULL,
    sent_count INTEGER DEFAULT 0 NOT NULL,
    failed_count INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    scheduled_at TEXT NOT NULL,
    finished_at TEXT,
    create_time TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);
