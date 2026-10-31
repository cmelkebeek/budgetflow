import { LogOut, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Security, User } from '../../../../shared/types';
import { PageHeader } from '../../components/layout';
import { api } from '../../lib/api';
import { toastError } from '../../lib/toast';
import { AppearanceCard } from './AppearanceCard';
import { EmailCard } from './EmailCard';
import { PasskeysCard } from './PasskeysCard';
import { PasswordCard } from './PasswordCard';
import { TwoFactorCard } from './TwoFactorCard';

interface Props {
  user: User;
  onUserChange: (user: User) => void;
  onLogout: () => void;
}

export function AccountPage({ user, onUserChange, onLogout }: Props) {
  const [security, setSecurity] = useState<Security | null>(null);
  const reload = useCallback(() => api<Security>('/me/security').then(setSecurity, toastError), []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <>
      <PageHeader title="Compte" subtitle="Profil, apparence et sécurité" icon={<UserRound size={20} />} />
      <div className="stack-lg">
        <section className="card profile">
          <span className="avatar large">{user.displayName.charAt(0).toUpperCase()}</span>
          <div className="row-main">
            <span className="row-title">{user.displayName}</span>
            <span className="row-meta">@{user.username}</span>
          </div>
          <button className="ghost" onClick={onLogout}>
            <LogOut size={16} /> Se déconnecter
          </button>
        </section>
        <AppearanceCard />
        <EmailCard user={user} mailEnabled={security?.mailEnabled ?? true} onUserChange={onUserChange} />
        <PasskeysCard passkeys={security?.passkeys ?? []} onChange={(passkeys) => setSecurity((s) => s && { ...s, passkeys })} />
        <TwoFactorCard
          user={user}
          recoveryCodesLeft={security?.recoveryCodesLeft ?? 0}
          onChange={(u) => {
            onUserChange(u);
            reload();
          }}
          onCodesChange={reload}
        />
        <PasswordCard />
      </div>
    </>
  );
}
