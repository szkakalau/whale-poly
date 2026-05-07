'use client';

import { useState } from 'react';

type Props = {
  telegramConnected: boolean;
  botUrl: string;
};

export default function TelegramPaidPushCard({ telegramConnected, botUrl }: Props) {
  const [pushOn, setPushOn] = useState(true);

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
      <h2 className="text-lg font-semibold text-white mb-2">Telegram 推送设置</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-2xl leading-relaxed">
        绑定 Telegram 后，新信号会通过 Telegram 推送给你，通常比页面轮询更快。关闭或静音请在 Telegram 内使用机器人提供的命令（本站不存储推送开关）。
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
        <a
          href={botUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
        >
          {telegramConnected ? '打开 Telegram Bot' : '绑定 Telegram'}
        </a>
        <span className="text-sm text-gray-300">
          {telegramConnected ? (
            <>
              <span className="text-emerald-400 font-medium">已绑定</span>
              <span className="text-gray-500 mx-2">|</span>
              <span className="text-gray-400">解绑或停用请在 Bot 内操作</span>
            </>
          ) : (
            <span className="text-amber-200/90">尚未绑定 · 点击按钮完成关联</span>
          )}
        </span>
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-200 select-none">
          <input
            type="checkbox"
            checked={pushOn}
            onChange={(e) => {
              const next = e.target.checked;
              if (!next) {
                window.alert(
                  '推送节奏由 Telegram 机器人侧策略决定。若要减少通知，请在 SightWhale Bot 内使用静音或订阅管理命令（本站不保存此开关）。',
                );
              }
              setPushOn(next);
            }}
            className="h-4 w-4 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500/40"
          />
          开启 Telegram 推送（说明）
        </label>
      </div>
      <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
        此为体验说明勾选框，不代表服务端订阅状态；实际投递以 Bot 与账号绑定为准。
      </p>
    </section>
  );
}
