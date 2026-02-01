'use client';

import { useState, useTransition } from 'react';
import WhaleFollowSettingsModal from './WhaleFollowSettingsModal';

type Props = {
  wallet: string;
  initialFollowed?: boolean;
};

export default function WhaleFollowButton({ wallet, initialFollowed }: Props) {
  const [open, setOpen] = useState(false);
  const [followed, setFollowed] = useState(Boolean(initialFollowed));
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!followed) {
      setOpen(true);
    } else {
      startTransition(async () => {
        await fetch(`/api/follow/${encodeURIComponent(wallet)}`, {
          method: 'DELETE',
        });
        setFollowed(false);
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`inline-flex items-center justify-center rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
          followed
            ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
            : 'border-white/20 bg-white/5 text-gray-200 hover:bg-white/10'
        } ${pending ? 'opacity-60 cursor-wait' : ''}`}
      >
        {followed ? 'Following' : 'Follow Whale'}
      </button>
      {open && (
        <WhaleFollowSettingsModal
          wallet={wallet}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setFollowed(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

