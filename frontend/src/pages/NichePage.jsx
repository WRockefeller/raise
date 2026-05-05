import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';

const NICHES = [
  'fitness', 'gaming', 'tech', 'music', 'cooking', 'travel',
  'cars', 'fashion', 'beauty', 'education', 'science', 'finance',
  'comedy', 'sports', 'film', 'animation', 'news', 'politics',
  'productivity', 'mindfulness', 'crypto', 'startups', 'design',
];

export default function NichePage() {
  const [value, setValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const suggestions = value.trim()
    ? NICHES.filter((n) => n.includes(value.toLowerCase().trim())).slice(0, 6)
    : NICHES.slice(0, 6);

  const handleSelect = async (niche) => {
    setValue(niche);
    setShowDropdown(false);
    setLoading(true);
    setError('');
    try {
      const updated = await api.setNiche(niche);
      updateUser({ niche: updated.niche });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) handleSelect(value.trim());
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <span className="font-mono text-accent text-xl font-medium">raise</span>
          <h1 className="text-3xl font-light text-white mt-4">What's your niche?</h1>
          <p className="text-white/30 mt-2 text-sm">We'll find the fastest-growing content for you.</p>
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="input-dark text-lg py-4 pr-24"
            placeholder="fitness, cars, tech…"
            autoFocus
          />
          <button
            type="submit"
            disabled={!value.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary disabled:opacity-40"
          >
            {loading ? '…' : 'Go'}
          </button>

          {/* Autocomplete dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute w-full mt-2 bg-surface-1 border border-border rounded-xl overflow-hidden z-10">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => handleSelect(s)}
                  className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-surface-2 hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>

        {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}

        {/* Trending niches */}
        <div className="mt-8">
          <p className="text-xs text-white/20 mb-3 uppercase tracking-widest">Trending niches</p>
          <div className="flex flex-wrap gap-2">
            {['fitness', 'tech', 'gaming', 'cars', 'music', 'finance'].map((n) => (
              <button
                key={n}
                onClick={() => handleSelect(n)}
                className="filter-pill"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
