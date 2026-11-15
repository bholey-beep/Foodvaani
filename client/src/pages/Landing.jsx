import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Shell';
import Icon from '../components/Icon';
import { api } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api('/donations/stats').then(setStats).catch(() => {});
  }, []);

  const cta = user ? homeFor(user) : '/login';

  return (
    <div className="landing">
      <header className="landing__top">
        <Logo />
        <Link to={cta} className="btn btn--ghost">{user ? 'Open dashboard' : 'Sign in'}</Link>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <h1 className="hero__title">Food left over tonight? Just say it.</h1>
          <p className="hero__lede">
            Restaurants record a short voice note in Hindi, English or eight other Indian languages.
            FoodVaani turns it into a pickup listing that people and NGOs nearby can read, hear, and act on.
          </p>
          <div className="hero__actions">
            <Link to={cta} className="btn btn--primary btn--lg">
              {user ? 'Go to your dashboard' : 'Sign in with your mobile number'}
            </Link>
          </div>
          {stats && (stats.active > 0 || stats.restaurants > 0) && (
            <p className="hero__live">
              <span className="dot" /> {stats.active} {stats.active === 1 ? 'listing is' : 'listings are'} open for pickup right now
              {stats.restaurants > 0 && <>, from {stats.restaurants} {stats.restaurants === 1 ? 'kitchen' : 'kitchens'}</>}
            </p>
          )}
        </div>

        <figure className="demo" aria-label="Example: a voice note becoming a listing">
          <div className="demo__voice">
            <span className="demo__mic"><Icon name="mic" size={22} /></span>
            <blockquote lang="hi">
              “हमारे पास तीस प्लेट वेज बिरयानी है, दोपहर एक बजे बनाई थी, शाम छह बजे तक ले जा सकते हैं।”
            </blockquote>
            <figcaption>Rahul, Sharma Bhojnalaya, 3:12 pm</figcaption>
          </div>
          <div className="demo__row">
            <div className="demo__time">
              <span className="demo__by">Pick up by</span>
              <span className="demo__clock">6:00 pm</span>
            </div>
            <div className="demo__body">
              <strong>Veg biryani</strong>
              <span>30 plates. Cooked at 1:00 pm, kept hot.</span>
              <span className="demo__place"><Icon name="pin" size={15} /> Near NIT Hamirpur main gate</span>
            </div>
          </div>
        </figure>
      </section>

      <section className="how">
        <div className="how__col">
          <h2>If you run a kitchen</h2>
          <ol className="steps">
            <li><strong>Speak.</strong> Tap the mic and describe what's left. No forms, no typing.</li>
            <li><strong>Check.</strong> We fill in the details from what you said and point out anything missing. You fix it and confirm.</li>
            <li><strong>Publish.</strong> The listing goes live with an audio version, and your saved address and number are attached.</li>
            <li><strong>Update.</strong> Mark it reserved or collected when people come. It disappears on its own after the pickup time.</li>
          </ol>
        </div>
        <div className="how__col">
          <h2>If you need food, or feed others</h2>
          <ol className="steps">
            <li><strong>Browse.</strong> See what's available near you, sorted by how soon it must be picked up.</li>
            <li><strong>Listen.</strong> Every listing can be played aloud, so reading isn't a barrier.</li>
            <li><strong>Call.</strong> One tap rings the restaurant's verified number to confirm it's still there.</li>
            <li><strong>Collect.</strong> Go to the kitchen before the deadline. There's no delivery and no middleman.</li>
          </ol>
        </div>
      </section>

      <section className="rules">
        <h2>What can be listed</h2>
        <div className="rules__grid">
          <p><strong>Only clean, unserved surplus.</strong> Never food returned from a customer's plate or already served.</p>
          <p><strong>The owner vouches for it.</strong> Before publishing, the restaurant confirms the food was handled and stored properly.</p>
          <p><strong>The software doesn't judge safety.</strong> It only writes down what was said and flags what wasn't.</p>
          <p><strong>Always confirm by phone.</strong> Ask about ingredients, allergens and timing before you go.</p>
        </div>
      </section>

      <footer className="landing__foot">
        <Logo light />
        <p>Built for the Gnani hackathon. Speech recognition by Gnani Prisma, voice by Gnani Timbre.</p>
      </footer>
    </div>
  );
}
