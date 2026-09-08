import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { authAPI } from '../../api/services';
import logoImg from '../../assets/images/logo.png';

// Resend form shown when the link is expired or invalid
function ResendForm() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setError('');
    setLoading(true);
    try {
      await authAPI.resendVerification({ email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <p className="text-sm text-green-600 font-medium text-center bg-green-50 border border-green-200 rounded-xl px-4 py-3">
      ✓ A new verification link has been sent to your email.
    </p>
  );

  return (
    <form onSubmit={handleResend} className="mt-2">
      <p className="text-sm text-gray-500 mb-3 text-center">Resend a new verification link:</p>
      {error && <p className="text-xs text-red-600 mb-2 text-center">{error}</p>}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 bg-primary-800 hover:bg-primary-900 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Resend'}
        </button>
      </div>
    </form>
  );
}

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token  = searchParams.get('token');
  const result = searchParams.get('result'); // set by PHP redirect: 'success' | 'error'
  const msg    = searchParams.get('msg');    // human-readable message from PHP

  const [status,  setStatus]  = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Case 1: PHP already verified and redirected here with result params
    if (result) {
      // useSearchParams already URL-decodes the values — don't decode again
      setMessage(msg || '');
      setStatus(result === 'success' ? 'success' : 'error');
      return;
    }

    // Case 2: Direct API call with token (Axios from the app)
    if (!token) { setStatus('no-token'); return; }

    authAPI.verifyEmail(token)
      .then(res => { setMessage(res.data.message); setStatus('success'); })
      .catch(err => {
        const errMsg = err.response?.data?.message || 'Verification failed.';
        if (err.response?.status === 409 || errMsg.toLowerCase().includes('already verified')) {
          setMessage(errMsg);
          setStatus('success');
        } else {
          setMessage(errMsg);
          setStatus('error');
        }
      });
  }, [token, result, msg]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <img src={logoImg} alt="Bago Market" className="h-9 w-auto" />
          <span className="font-bold text-primary-900">Bago City Marketplace</span>
        </Link>

        {status === 'loading' && (
          <>
            <Loader2 size={48} className="text-primary-700 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Verifying your email…</h2>
            <p className="text-gray-500 text-sm">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Email Verified!</h2>
            <p className="text-gray-500 text-sm mb-6">{message}</p>
            <Link to="/"
              className="inline-block bg-primary-800 hover:bg-primary-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors">
              Go to Marketplace
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={52} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Verification Failed</h2>
            <p className="text-gray-500 text-sm mb-5">{message}</p>
            <ResendForm />
            <Link to="/" className="block text-center mt-4 text-sm text-gray-400 hover:text-primary-800 transition-colors">
              Back to Home
            </Link>
          </>
        )}

        {status === 'no-token' && (
          <>
            <Mail size={52} className="text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h2>
            <p className="text-gray-500 text-sm mb-5">
              We sent a verification link to your email. Click the link to activate your account.
            </p>
            <ResendForm />
            <Link to="/" className="block text-center mt-4 text-sm text-gray-400 hover:text-primary-800 transition-colors">
              Back to Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
