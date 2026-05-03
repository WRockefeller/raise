import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Navbar({ filters, onFilterChange }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <span className="font-mono text-accent font-medium tracking-tight text-lg">raise</span>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar">
          {/* Time filters */}
          <div className="flex gap-1.5 shrink-0">
            {['today', 'week', 'month'].map((t) => (
              <button
                key={t}
                onClick={() => onFilterChange({ time: t })}
                className={`filter-pill ${filters.time === t ? 'active' : ''}`}
              >
                {t === 'today' ? 'Today' : t === 'week' ? 'This week' : 'This month'}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border shrink-0 mx-1" />

          {/* Sort filters */}
          <div className="flex gap-1.5 shrink-0">
            {[
              { key: 'views', label: 'Most viewed' },
              { key: 'trending', label: 'Trending' },
              { key: 'newest', label: 'Newest' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => onFilterChange({ sort: s.key })}
                className={`filter-pill ${filters.sort === s.key ? 'active' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Current niche badge */}
          {user?.niche && (
            <>
              <div className="w-px h-5 bg-border shrink-0 mx-1" />
              <button
                onClick={() => navigate('/niche')}
                className="filter-pill text-accent border-accent/40"
              >
                #{user.niche}
              </button>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs text-white/60 hover:border-white/40 transition-colors"
          >
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 bg-surface-1 border border-border rounded-xl overflow-hidden w-48 z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { navigate('/niche'); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-surface-2 transition-colors"
              >
                Change niche
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-surface-2 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
