export function VideoCard({ video }) {
  const {
    id,
    title,
    channel,
    thumbnail,
    views,
    growthLabel,
    publishedAt,
  } = video;

  const url = `https://www.youtube.com/watch?v=${id}`;
  const timeAgo = getTimeAgo(publishedAt);
  const viewsFormatted = formatViews(views);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-surface-1 border border-border rounded-xl overflow-hidden hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-2 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10 text-xs">
            No thumbnail
          </div>
        )}

        {/* Growth badge */}
        {growthLabel && (
          <div className="absolute top-2 left-2 bg-black/80 border border-accent/40 text-accent font-mono text-xs px-2 py-0.5 rounded-full">
            {growthLabel}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-1.5 group-hover:text-accent transition-colors">
          {title}
        </h3>
        <div className="flex items-center justify-between mt-auto">
          <p className="text-xs text-white/40 truncate max-w-[60%]">{channel}</p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-white/40">{viewsFormatted}</span>
            {timeAgo && (
              <span className="text-xs text-white/20">{timeAgo}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      <div className="aspect-video skeleton" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="flex justify-between mt-2">
          <div className="skeleton h-3 w-1/3 rounded" />
          <div className="skeleton h-3 w-1/4 rounded" />
        </div>
      </div>
    </div>
  );
}

function formatViews(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K views`;
  return `${n} views`;
}

function getTimeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
