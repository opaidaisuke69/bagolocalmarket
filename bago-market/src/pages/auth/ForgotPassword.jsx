import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '../../api/services';
import logoImg from '../../assets/images/logo.png';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch {
      // Always show success to prevent enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <img src={logoImg} alt="Bago Market" className="h-10 w-auto" />
          <span className="text-white font-bold text-lg">Bago City Marketplace</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!sent ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Mail size={20} className="text-primary-800" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">Forgot Password</h1>
                  <p className="text-sm text-gray-500">We'll send a reset link to your email</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent focus:bg-white outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-800 hover:bg-primary-900 text-white py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Sending...</>
                    : 'Send Reset Link'}
                </button>
              </form>

              <Link to="/" className="flex items-center justify-center gap-1.5 mt-5 text-sm text-gray-500 hover:text-primary-800 transition-colors">
                <ArrowLeft size={14} /> Back to marketplace
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h2>
              <p className="text-gray-500 text-sm mb-2">
                If <span className="font-semibold text-gray-700">{email}</span> is registered,
                you'll receive a password reset link shortly.
              </p>
              <p className="text-xs text-gray-400 mb-6">The link expires in 1 hour. Check your spam folder if you don't see it.</p>
              <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary-800 hover:underline font-medium">
                <ArrowLeft size={14} /> Back to marketplace
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
