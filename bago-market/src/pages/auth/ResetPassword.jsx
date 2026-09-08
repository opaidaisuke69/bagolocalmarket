import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Check, X, CheckCircle, XCircle } from 'lucide-react';
import { authAPI } from '../../api/services';
import logoImg from '../../assets/images/logo.png';

export default function ResetPassword() {
  const [searchParams]        = useSearchParams();
  const token                 = searchParams.get('token');
  const navigate              = useNavigate();

  const [tokenState, setTokenState] = useState('checking'); // checking | valid | invalid
  const [tokenMsg,   setTokenMsg]   = useState('');
  const [userEmail,  setUserEmail]  = useState('');

  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(false);

  // ── Validate token on mount ──────────────────────────────────
  useEffect(() => {
    if (!token) { setTokenState('invalid'); setTokenMsg('No reset token found.'); return; }
    authAPI.validateResetToken(token)
      .then(res => {
        setTokenState('valid');
        setUserEmail(res.data.email || '');
      })
      .catch(err => {
        setTokenState('invalid');
        setTokenMsg(err.response?.data?.message || 'Invalid or expired reset link.');
      });
  }, [token]);

  // ── Password strength ────────────────────────────────────────
  const getStrength = () => {
    if (!password) return { level: 0, label: '', color: '' };
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return [
      { level: 1, label: 'Weak',   color: 'bg-red-500'    },
      { level: 2, label: 'Fair',   color: 'bg-orange-500' },
      { level: 3, label: 'Good',   color: 'bg-yellow-500' },
      { level: 4, label: 'Strong', color: 'bg-green-500'  },
    ][s - 1] || { level: 0, label: '', color: '' };
  };
  const strength = getStrength();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, password, confirm_password: confirm });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── States ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <img src={logoImg} alt="Bago Market" className="h-10 w-auto" />
          <span className="text-white font-bold text-lg">Bago City Marketplace</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Checking token */}
          {tokenState === 'checking' && (
            <div className="text-center py-6">
              <Loader2 size={40} className="text-primary-700 animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Validating reset link…</p>
            </div>
          )}

          {/* Invalid token */}
          {tokenState === 'invalid' && (
            <div className="text-center py-4">
              <XCircle size={52} className="text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Link Invalid or Expired</h2>
              <p className="text-gray-500 text-sm mb-6">{tokenMsg}</p>
              <Link to="/forgot-password"
                className="inline-block bg-primary-800 hover:bg-primary-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors">
                Request New Link
              </Link>
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="text-center py-4">
              <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Password Reset!</h2>
              <p className="text-gray-500 text-sm mb-6">Your password has been updated. You can now log in with your new password.</p>
              <button
                onClick={() => navigate('/')}
                className="inline-block bg-primary-800 hover:bg-primary-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors">
                Go to Marketplace
              </button>
            </div>
          )}

          {/* Reset form */}
          {tokenState === 'valid' && !done && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-800">Set New Password</h1>
                {userEmail && (
                  <p className="text-sm text-gray-500 mt-1">Resetting password for <span className="font-medium text-gray-700">{userEmail}</span></p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent focus:bg-white outline-none pr-11 transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400">{strength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent focus:bg-white outline-none pr-11 transition-all"
                    />
                    {confirm && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {password === confirm
                          ? <Check size={16} className="text-green-500" />
                          : <X size={16} className="text-red-500" />}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-800 hover:bg-primary-900 text-white py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Resetting...</>
                    : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
