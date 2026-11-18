import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import heroImage from '../assets/hero.webp';
import './Landing.css';

const demoProfiles = [
  { label: 'Médecin demandeur — Dr. Dupont', username: 'dr.dupont', password: 'demo' },
  { label: 'Radiologue — Dr. Martin', username: 'dr.martin', password: 'demo' },
  { label: 'Console de modalité — Scanner CT01', username: 'modality_ct', password: 'demo' },
  { label: 'Administration — DSI', username: 'admin', password: 'admin' },
];

const workflowSteps = [
  'Demande',
  'Planification',
  'Acquisition',
  'Compte rendu',
  'Téléexpertise',
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const showDemoProfiles = import.meta.env.DEV
    || import.meta.env.MODE === 'debug'
    || import.meta.env.VITE_DEBUG === 'true';

  const submitLogin = async (event, credentials = { username, password }) => {
    event?.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(credentials.username, credentials.password);
      navigate('/dashboard');
    } catch (loginError) {
      setError(
        loginError.response?.data?.detail
          || 'Identifiants invalides. Vérifiez votre nom d’utilisateur et votre mot de passe.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loginWithDemo = (profile) => submitLogin(null, {
    username: profile.username,
    password: profile.password,
  });

  return (
    <main className="login-page">
      <div className="login-page__image" aria-hidden="true"><img src={heroImage} alt="" /></div>
      <div className="login-page__veil" />
      <section className="login-welcome" aria-label="Bienvenue">
        <Link to="/" aria-label="RadioPlatform, accueil"><span className="public-brand"><span className="public-brand__mark"><Activity /></span><span>RadioPlatform</span></span></Link>
        <span className="eyebrow">Imagerie médicale coordonnée</span>
        <h1>Le parcours clinique, clair à chaque étape.</h1>
        <p>Un espace partagé pour suivre les demandes d’examen, de la prescription à la transmission du compte rendu.</p>
        <div className="login-workflow" aria-label="Étapes du parcours">
          {workflowSteps.map((step, index) => <span key={step}><i>{String(index + 1).padStart(2, '0')}</i>{step}</span>)}
        </div>
      </section>

      <section className="login-card" aria-labelledby="login-title">
        <p className="login-card__eyebrow">Espace professionnel</p>
        <h2 id="login-title">Connexion</h2>
        <p className="login-card__intro">Connectez-vous pour accéder à votre espace de travail radiologique.</p>

        <form onSubmit={submitLogin} className="login-form">
          <div>
            <label htmlFor="username">Identifiant</label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password">Mot de passe</label>
            <div className="login-form__password">
              <input
                id="password"
                type={passwordVisible ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={passwordVisible}
              >
                {passwordVisible ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="button button--primary login-form__submit">
            {loading ? 'Connexion en cours…' : 'Se connecter'}
            {!loading && <ArrowRight aria-hidden="true" />}
          </button>
        </form>

        {error && <div role="alert" className="login-error">{error}</div>}

        {showDemoProfiles && (
          <div className="demo-profiles">
            <p>Profils de démonstration</p>
            <ul>
              {demoProfiles.map((profile) => (
                <li key={profile.username}>
                  <button type="button" disabled={loading} onClick={() => loginWithDemo(profile)}>{profile.label}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link className="login-back" to="/"><ArrowLeft aria-hidden="true" /> Retour à l’accueil</Link>
      </section>
    </main>
  );
}
