import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../utils/api';
import Navbar from '../../components/layout/Navbar';
import { VideoCard, VideoCardSkeleton } from '../../components/dashboard/VideoCard';

const DEFAULT_FILTERS = { time: 'week', sort: 'trending' };
const SKELETON_COUNT = 12;

export default function DashboardPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const fetchVideos = useCallback(async (f) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getVideos({ niche: user?.niche, ...f });
      setVideos(data.videos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.niche]);

  useEffect(() => {
    fetchVideos(filters);
  }, [filters, fetchVideos]);

  const handleFilterChange = (partial) => {
    const next = { ...filters, ...partial };
    setFilters(next);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar filters={filters} onFilterChange={handleFilterChange} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-white/80 text-lg font-light">
            {loading ? 'Loading…' : error ? 'Something went wrong' : (
              <>
                <span className="text-white font-medium">{videos.length}</span>{' '}
                {filters.sort === 'trending' ? 'trending' : filters.sort === 'newest' ? 'new' : 'popular'} videos
                {user?.niche ? (
                  <> in <span className="text-accent">#{user.niche}</span></>
                ) : null}
              </>
            )}
          </h1>
        </div>

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
            <button
              onClick={() => fetchVideos(filters)}
              className="ml-3 underline text-red-300 hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Video grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))
            : videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
        </div>

        {/* Empty state */}
        {!loading && !error && videos.length === 0 && (
          <div className="text-center py-20 text-white/20">
            <p className="text-lg">No videos found</p>
            <p className="text-sm mt-1">Try a different niche or time range</p>
          </div>
        )}
      </main>
    </div>
  );
}
