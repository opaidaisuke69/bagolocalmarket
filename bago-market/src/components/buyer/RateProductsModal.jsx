import { useState, useEffect, useCallback } from 'react';
import { X, Star, Package, CheckCircle, Edit3, Send, ChevronRight } from 'lucide-react';
import { productsAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';

/* ─────────────────────────────────────────────
   Interactive star picker
───────────────────────────────────────────── */
function StarPicker({ value, onChange, size = 32 }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onTouchStart={() => setHovered(star)}
            onTouchEnd={() => { onChange(star); setHovered(0); }}
            onClick={() => onChange(star)}
            className="transition-transform duration-100 hover:scale-110 active:scale-95 cursor-pointer touch-manipulation"
          >
            <Star
              size={size}
              className={`transition-colors duration-150 ${
                star <= active
                  ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm'
                  : 'text-gray-200 fill-gray-100'
              }`}
            />
          </button>
        ))}
      </div>
      <span className={`text-sm font-semibold transition-colors duration-150 h-5 ${
        active > 0 ? 'text-yellow-600' : 'text-gray-300'
      }`}>
        {labels[active] || ''}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Single product review card
   existingReview shape: { id, rating, review } | null
───────────────────────────────────────────── */
function ReviewCard({ item, orderId, existingReview, onSubmitted }) {
  const { showToast } = useToast();

  // Derive initial state from existingReview
  const initRating  = Number(existingReview?.rating  ?? 0);
  const initComment = existingReview?.review ?? '';
  const initId      = existingReview?.id     ?? null;

  const [rating,    setRating]    = useState(initRating);
  const [comment,   setComment]   = useState(initComment);
  const [savedId,   setSavedId]   = useState(initId);   // DB row id once saved
  const [submitted, setSubmitted] = useState(initRating > 0); // only true if rating exists
  const [editing,   setEditing]   = useState(false);
  const [loading,   setLoading]   = useState(false);

  // Re-sync if existingReview prop changes (modal re-used with fresh data)
  useEffect(() => {
    const r = Number(existingReview?.rating ?? 0);
    const c = existingReview?.review ?? '';
    const i = existingReview?.id ?? null;
    setRating(r);
    setComment(c);
    setSavedId(i);
    setSubmitted(r > 0);
    setEditing(false);
  }, [existingReview?.id, existingReview?.rating]);

  const isEditing = editing || !submitted;

  // Dirty = values differ from what was last saved
  const isDirty = rating !== initRating || comment !== initComment;

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast('Please select a star rating.', 'error');
      return;
    }
    setLoading(true);
    try {
      let newId = savedId;
      if (savedId) {
        // Update existing review
        await productsAPI.updateReview({
          review_id: savedId,
          product_id: item.product_id,
          rating,
          comment,
        });
        showToast('Review updated!', 'success');
      } else {
        // New review
        const res = await productsAPI.submitReview({
          product_id: item.product_id,
          order_id: orderId,
          rating,
          comment,
        });
        newId = res.data?.review_id ?? null;
        showToast('Review submitted!', 'success');
      }
      setSavedId(newId);
      setSubmitted(true);
      setEditing(false);
      onSubmitted(item.product_id, { id: newId, rating, review: comment });
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to submit review.';
      // If duplicate (409) the review already exists — treat as success
      if (err?.response?.status === 409) {
        setSubmitted(true);
        setEditing(false);
        onSubmitted(item.product_id, { id: savedId, rating, review: comment });
        showToast('Review already submitted.', 'success');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setRating(initRating);
    setComment(initComment);
    setEditing(false);
  };

  return (
    <div className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
      submitted && !editing ? 'border-green-200 bg-green-50/40' : 'border-gray-100 bg-white'
    }`}>
      {/* Product info row */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden shrink-0">
          {item.product_image
            ? <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-gray-300" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
          {item.variation_label && (
            <p className="text-xs text-primary-700 font-semibold mt-0.5">{item.variation_label}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{item.store_name} · x{item.quantity}</p>
        </div>
        {submitted && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-primary-700 font-semibold bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-lg transition-colors touch-manipulation"
          >
            <Edit3 size={11} /> Edit
          </button>
        )}
      </div>

      {/* Body */}
      {isEditing ? (
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center py-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Rating</p>
            <StarPicker value={rating} onChange={setRating} size={36} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Your Review <span className="text-gray-300 font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Share your experience with this product…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder:text-gray-300 transition-all"
            />
            <p className="text-right text-[10px] text-gray-300 mt-1">{comment.length}/500</p>
          </div>

          <div className="flex gap-2.5">
            {submitted && (
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors touch-manipulation"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading || rating === 0 || (submitted && !isDirty)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-800 hover:bg-primary-900 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <><Send size={14} />{submitted ? 'Update Review' : 'Submit Review'}</>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={16}
                  className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
              <CheckCircle size={13} /> Reviewed
            </div>
          </div>
          {comment && <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{comment}</p>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main modal
───────────────────────────────────────────── */
export default function RateProductsModal({ order, onClose, onAllReviewed }) {
  // existingReviews: keyed by product_id (string), loaded from server
  const [existingReviews,  setExistingReviews]  = useState({});
  const [loadingReviews,   setLoadingReviews]   = useState(true);
  // localReviews: keyed by product_id (number/string), updated as user submits
  const [localReviews,     setLocalReviews]     = useState({});

  // Unique products (de-dup in case same product appears multiple times)
  const reviewableItems = (order?.items ?? []).filter(
    (item, idx, arr) => arr.findIndex((i) => String(i.product_id) === String(item.product_id)) === idx
  );

  const loadMyReviews = useCallback(async () => {
    if (!order?.id) return;
    setLoadingReviews(true);
    try {
      const res = await productsAPI.myReviews({ order_id: order.id });
      // Normalize keys to strings
      const raw = res.data.by_product || {};
      const normalized = {};
      Object.keys(raw).forEach(k => { normalized[String(k)] = raw[k]; });
      setExistingReviews(normalized);
    } catch {
      setExistingReviews({});
    } finally {
      setLoadingReviews(false);
    }
  }, [order?.id]);

  useEffect(() => {
    loadMyReviews();
  }, [loadMyReviews]);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmitted = useCallback((productId, reviewData) => {
    setLocalReviews(prev => ({ ...prev, [String(productId)]: reviewData }));
  }, []);

  // Merge: localReviews (just submitted) override existingReviews (from server)
  const mergedReviews  = { ...existingReviews, ...localReviews };
  const reviewedCount  = reviewableItems.filter(i => mergedReviews[String(i.product_id)]?.rating > 0).length;
  const allReviewsDone = reviewableItems.length > 0 && reviewedCount >= reviewableItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-primary-800 to-primary-900 px-6 pt-6 pb-5 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Rate Your Purchase</h2>
              <p className="text-white/60 text-xs mt-1">
                Order #{order?.order_number} · {reviewableItems.length} product{reviewableItems.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors shrink-0 ml-4">
              <X size={15} className="text-white" />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
              <span>{reviewedCount} of {reviewableItems.length} reviewed</span>
              {allReviewsDone && (
                <span className="text-yellow-300 font-semibold flex items-center gap-1">
                  <CheckCircle size={11} /> All done!
                </span>
              )}
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${reviewableItems.length > 0 ? (reviewedCount / reviewableItems.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loadingReviews ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-800 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Loading your reviews…</p>
            </div>
          ) : (
            reviewableItems.map((item) => (
              <ReviewCard
                key={String(item.product_id)}
                item={item}
                orderId={order.id}
                existingReview={mergedReviews[String(item.product_id)] ?? null}
                onSubmitted={handleSubmitted}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => {
              // Pass count of reviewed products so Orders list can update immediately
              onAllReviewed?.(reviewedCount);
              onClose();
            }}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 touch-manipulation ${
              allReviewsDone
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {allReviewsDone
              ? <><CheckCircle size={16} /> Done — Back to Orders</>
              : <><ChevronRight size={16} /> Skip & Close</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
