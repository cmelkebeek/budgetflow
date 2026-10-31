import { CalendarDays, ChartColumn, LogOut, Moon, Repeat, ShoppingBag, Sun, UserRound, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { User } from '../../shared/types';
import { ReauthPrompt } from './components/ReauthPrompt';
import { Splash, Toaster, TopLoader } from './components/feedback';
import { api } from './lib/api';
import { currentMonth } from './lib/format';
import { useTheme } from './lib/theme';
import { AccountPage } from './pages/account/AccountPage';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { Welcome } from './pages/auth/Welcome';
import { HistoryPage } from './pages/history/HistoryPage';
import { MonthPage } from './pages/month/MonthPage';
import { RecurringPage } from './pages/recurring/RecurringPage';
import { WishesPage } from './pages/wishes/WishesPage';

const NAV = [
  { id: 'month', label: 'Mois', icon: CalendarDays },
  { id: 'recurring', label: 'Charges', icon: Repeat },
  { id: 'wishes', label: 'Achats', icon: ShoppingBag },
  { id: 'history', label: 'Historique', icon: ChartColumn },
  { id: 'account', label: 'Compte', icon: UserRound },
] as const;

type Tab = (typeof NAV)[number]['id'];

// Lien reçu par e-mail : /#reset=<jeton>. Lu une seule fois au chargement, puis retiré de l'adresse
// pour ne pas rester dans l'historique du navigateur.
const initialResetToken = new URLSearchParams(location.hash.slice(1)).get('reset');
if (initialResetToken) history.replaceState(null, '', location.pathname);

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('month');
  const [month, setMonth] = useState(currentMonth);
  const [welcome, setWelcome] = useState(false);
  const [resetToken, setResetToken] = useState(initialResetToken);
  const { resolved, setTheme } = useTheme();

  useEffect(() => {
    api<User>('/me').then(setUser, () => setUser(null));
    const onUnauthorized = () => setUser(null);
    window.addEventListener('unauthorized', onUnauthorized);
    return () => window.removeEventListener('unauthorized', onUnauthorized);
  }, []);

  if (resetToken) {
    return (
      <>
        <TopLoader />
        <ResetPasswordPage
          token={resetToken}
          onDone={() => {
            setResetToken(null);
            setUser(null); // la réinitialisation ferme toutes les sessions
          }}
        />
        <Toaster />
      </>
    );
  }
  if (user === undefined) return <Splash />;
  if (user === null) {
    return (
      <>
        <TopLoader />
        <LoginPage
          onLogin={(u) => {
            setTab('month');
            setMonth(currentMonth());
            setUser(u);
            setWelcome(true);
          }}
        />
        <Toaster />
      </>
    );
  }

  const logout = () => api('/logout', { method: 'POST' }).finally(() => setUser(null));

  return (
    <div className="shell">
      <TopLoader />
      {welcome && <Welcome name={user.displayName} onDone={() => setWelcome(false)} />}
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">
            <Wallet size={18} />
          </span>
          Budget
        </div>
        <nav>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={id === tab ? 'nav-item active' : 'nav-item'} onClick={() => setTab(id)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{user.displayName.charAt(0).toUpperCase()}</span>
          <span className="sidebar-name">{user.displayName}</span>
          <button
            className="icon-btn"
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            aria-label={resolved === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            title={resolved === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-btn" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="content" key={tab}>
        {tab === 'month' && <MonthPage month={month} onMonthChange={setMonth} />}
        {tab === 'recurring' && <RecurringPage />}
        {tab === 'wishes' && <WishesPage month={month} />}
        {tab === 'history' && (
          <HistoryPage
            onOpen={(m) => {
              setMonth(m);
              setTab('month');
            }}
          />
        )}
        {tab === 'account' && <AccountPage user={user} onUserChange={setUser} onLogout={logout} />}
      </main>
      <ReauthPrompt />
      <Toaster />
    </div>
  );
}
