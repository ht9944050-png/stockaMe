'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (isSignUp) {
      // Inscription
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setMessage('Erreur d\'inscription : ' + error.message);
      } else {
        setMessage('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
        setIsSignUp(false);
      }
    } else {
      // Connexion
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage('Erreur de connexion : ' + error.message);
      } else {
        router.push('/'); // Rediriger vers le tableau de bord
      }
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">StockMa 🇲🇦</h1>
          <p className="text-gray-600 text-sm mt-1">
            {isSignUp ? 'Créer un compte commerçant' : 'Espace Connexion'}
          </p>
        </div>

        {message && (
          <div className="mb-4 p-3 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email</label>
            <input
              type="email"
              required
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mot de passe</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold p-3 rounded-lg text-sm transition shadow-sm"
          >
            {loading ? 'Chargement...' : isSignUp ? 'S\'inscrire' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-green-700 hover:underline font-semibold"
          >
            {isSignUp
              ? 'Vous avez déjà un compte ? Connectez-vous'
              : 'Pas encore de compte ? Inscrivez-vous gratuitement'}
          </button>
        </div>
      </div>
    </main>
  );
}