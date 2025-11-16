import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';

const DownloadManager = () => {
  const { downloads, removeDownload } = useStore();

  const formatBytes = (n?: number) => {
    if (!n || n <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
    return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const formatSpeed = (bps?: number) => {
    if (!bps || bps <= 0) return '';
    const perSec = formatBytes(bps) + '/s';
    return perSec;
  };

  if (downloads.length === 0) return null;

  // Hide per-core cards when bulk install is active
  const bulkActive = downloads.some(d => d.slug === 'install_all_cores' && d.stage !== 'completed');
  let visibleDownloads = downloads;
  if (bulkActive) {
    // During bulk install, only show the aggregated card
    visibleDownloads = downloads.filter(d => d.slug === 'install_all_cores');
  } else {
    // Otherwise cap to the 3 most recent
    visibleDownloads = downloads.slice(-3);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-md w-full">
      <AnimatePresence>
        {visibleDownloads.map((download) => (
          <motion.div
            key={download.slug}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="bg-dark-800/95 backdrop-blur-lg border border-dark-700 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 pb-2 flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {download.progress === 100 ? (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <Download className="w-5 h-5 text-primary-400 animate-bounce flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white truncate">{download.title}</h4>
                  <p className="text-xs text-dark-400">{download.message}</p>
                </div>
              </div>

              {download.progress === 100 && (
                <button
                  onClick={() => removeDownload(download.slug)}
                  className="text-dark-400 hover:text-white transition-colors p-1 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="px-4 pb-4">
              <div className="relative h-2 bg-dark-900 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${download.progress}%` }}
                  transition={{ duration: 0.3 }}
                  className={`h-full rounded-full ${
                    download.progress === 100
                      ? 'bg-green-500'
                      : 'bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)]'
                  }`}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-dark-500">{download.stage}</span>
                <span className="text-xs font-mono text-dark-400">
                  {Math.round(download.progress)}%
                </span>
              </div>
              {(download.totalBytes || download.bytesReceived || download.speedBps) && (
                <div className="mt-1 text-[10px] text-dark-500 font-mono flex justify-between">
                  <span>
                    {formatBytes(download.bytesReceived)}
                    {download.totalBytes ? ` / ${formatBytes(download.totalBytes)}` : ''}
                  </span>
                  <span>{formatSpeed(download.speedBps)}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default DownloadManager;
