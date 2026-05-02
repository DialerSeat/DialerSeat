import Link from "next/link";

export default function Home() {
  return (
    <main style={{ background: 'var(--background)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 60px',
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>D</span>
          </div>
          <span style={{
            fontSize: '18px',
            fontWeight: 'bold',
            letterSpacing: '6px',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
          }}>DIALERSEAT</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <Link href="#features" style={{
            fontSize: '12px',
            letterSpacing: '3px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>FEATURES</Link>
          <Link href="#pricing" style={{
            fontSize: '12px',
            letterSpacing: '3px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>PRICING</Link>
          <Link href="#compare" style={{
            fontSize: '12px',
            letterSpacing: '3px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>COMPARE</Link>
          <Link href="/sign-in" style={{
            fontSize: '12px',
            letterSpacing: '3px',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            padding: '10px 20px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            whiteSpace: 'nowrap',
          }}>SIGN IN</Link>
          <Link href="/sign-up" style={{
            fontSize: '12px',
            letterSpacing: '3px',
            color: 'white',
            textDecoration: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            whiteSpace: 'nowrap',
          }}>GET STARTED</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        padding: '120px 40px 80px',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 20px',
          borderRadius: '100px',
          border: '1px solid var(--border)',
          color: 'var(--accent-blue)',
          background: 'rgba(74,158,255,0.05)',
          fontSize: '11px',
          letterSpacing: '3px',
          marginBottom: '48px',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--accent-blue)',
          }}></div>
          7-DAY FREE TRIAL · CARD REQUIRED · CANCEL ANYTIME
        </div>

        <h1 style={{
          fontSize: '80px',
          fontWeight: 'bold',
          letterSpacing: '-2px',
          lineHeight: '1.05',
          marginBottom: '32px',
          maxWidth: '900px',
        }}>
          <span style={{ color: 'var(--text-primary)' }}>DIAL </span>
          <span style={{
            background: 'linear-gradient(135deg, #4a9eff, #a0c4ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>SMARTER.</span>
          <br />
          <span style={{ color: 'var(--text-primary)' }}>CLOSE </span>
          <span style={{ color: 'var(--accent-silver)' }}>FASTER.</span>
        </h1>

        <p style={{
          fontSize: '18px',
          lineHeight: '1.8',
          letterSpacing: '1px',
          color: 'var(--text-secondary)',
          maxWidth: '600px',
          marginBottom: '48px',
        }}>
          The professional outbound dialer built for anyone who lives on the phone. Upload your leads, launch your campaigns, and let DialerSeat do the heavy lifting — for a fraction of what everyone else charges.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Link href="/sign-up" style={{
            padding: '16px 40px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'white',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            boxShadow: '0 0 40px rgba(74,158,255,0.3)',
          }}>
            START FREE TRIAL
          </Link>
          <Link href="#compare" style={{
            padding: '16px 40px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            border: '1px solid var(--border)',
          }}>
            SEE HOW WE COMPARE
          </Link>
        </div>

        <p style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
          7 DAYS FREE · THEN $35/WEEK · CANCEL ANYTIME
        </p>

        {/* STATS BAR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '48px',
          marginTop: '80px',
          padding: '32px 60px',
          borderRadius: '16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}>
          {[
            { number: '$35', label: 'PER WEEK' },
            { number: '7', label: 'DAY FREE TRIAL' },
            { number: '5X', label: 'CHEAPER THAN COMPETITORS' },
            { number: '∞', label: 'LEADS UPLOADED' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: 'var(--accent-blue)',
                letterSpacing: '-1px',
                marginBottom: '6px',
              }}>{stat.number}</div>
              <div style={{
                fontSize: '10px',
                letterSpacing: '3px',
                color: 'var(--text-secondary)',
              }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '120px 60px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            letterSpacing: '6px',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>BUILT FOR VOLUME</h2>
          <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
            FOR SALES TEAMS, CALL CENTERS, AGENCIES, AND ANYONE WHO WORKS LEADS.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
        }}>
          {[
            { icon: '⚡', title: 'INSTANT CAMPAIGNS', desc: 'Upload a CSV and launch a campaign in seconds. Run multiple campaigns simultaneously with zero setup time.' },
            { icon: '📞', title: 'PREDICTIVE DIALING', desc: 'Our dialer calls ahead so you are always talking to someone. Maximum live connections per hour, every hour.' },
            { icon: '🎯', title: 'LEAD MANAGEMENT', desc: 'Organize leads across unlimited campaigns. Track dispositions, callbacks, and conversion rates in real time.' },
            { icon: '📊', title: 'LIVE ANALYTICS', desc: 'Real time dashboard showing calls made, contacts reached, campaign performance, and team activity.' },
            { icon: '🏢', title: 'TEAM SEATS', desc: 'Buy seats for your whole team. Each member gets their own login, campaigns, and call data — all under one roof.' },
            { icon: '🔒', title: 'YOUR DATA ALWAYS', desc: 'Your leads stay saved even if your subscription lapses. Pick up right where you left off, no questions asked.' },
          ].map((f, i) => (
            <div key={i} style={{
              padding: '40px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '20px' }}>{f.icon}</div>
              <h3 style={{
                fontSize: '12px',
                fontWeight: 'bold',
                letterSpacing: '3px',
                color: 'var(--text-primary)',
                marginBottom: '12px',
              }}>{f.title}</h3>
              <p style={{
                fontSize: '14px',
                lineHeight: '1.7',
                color: 'var(--text-secondary)',
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '120px 60px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            letterSpacing: '6px',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>HOW IT WORKS</h2>
          <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
            FROM ZERO TO DIALING IN UNDER 2 MINUTES.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[
            { step: '01', title: 'CREATE YOUR ACCOUNT', desc: 'Sign up with Google or email. Enter your card to unlock your 7 day free trial. No charge until day 8.' },
            { step: '02', title: 'UPLOAD YOUR LEADS', desc: 'Drop your CSV into a campaign. Name it, organize it, and have multiple campaigns ready to go simultaneously.' },
            { step: '03', title: 'HIT DIAL AND GO', desc: 'Launch your campaign and DialerSeat starts working immediately. Live connections come through the second someone picks up.' },
            { step: '04', title: 'TRACK AND CLOSE', desc: 'Disposition every call in one click. Track your performance in real time. Rinse and repeat until your list is done.' },
          ].map((step, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '32px',
              padding: '40px',
              borderRadius: '16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: 'var(--accent-blue)',
                opacity: 0.3,
                lineHeight: 1,
                flexShrink: 0,
                letterSpacing: '-2px',
              }}>{step.step}</div>
              <div>
                <h3 style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  letterSpacing: '3px',
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                }}>{step.title}</h3>
                <p style={{
                  fontSize: '14px',
                  lineHeight: '1.7',
                  color: 'var(--text-secondary)',
                }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARE */}
      <section id="compare" style={{ padding: '120px 60px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            letterSpacing: '6px',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>WHY DIALERSEAT</h2>
          <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
            THE NUMBERS SPEAK FOR THEMSELVES.
          </p>
        </div>

        <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            padding: '20px 32px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>FEATURE</div>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--accent-blue)', textAlign: 'center' }}>DIALERSEAT</div>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)', textAlign: 'center' }}>READYMODE</div>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)', textAlign: 'center' }}>OTHERS</div>
          </div>

          {[
            { feature: 'Weekly Cost', us: '$35', them1: '$199+/mo', them2: '$150+/mo' },
            { feature: 'Free Trial', us: '7 Days', them1: '✗', them2: '✗' },
            { feature: 'No Contract', us: '✓', them1: '✗', them2: '✗' },
            { feature: 'Unlimited Leads', us: '✓', them1: '✓', them2: 'Limited' },
            { feature: 'Multi Campaign', us: '✓', them1: '✓', them2: '✓' },
            { feature: 'Data Saved Always', us: '✓', them1: '✗', them2: '✗' },
            { feature: 'Setup Fee', us: '$0', them1: '$0', them2: '$200+' },
            { feature: 'Plug & Play', us: '✓', them1: '✗', them2: '✗' },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              padding: '20px 32px',
              borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
            }}>
              <div style={{ fontSize: '13px', letterSpacing: '1px', color: 'var(--text-secondary)' }}>{row.feature}</div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-blue)', textAlign: 'center' }}>{row.us}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.6 }}>{row.them1}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.6 }}>{row.them2}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '120px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            letterSpacing: '6px',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>SIMPLE PRICING</h2>
          <p style={{ fontSize: '12px', letterSpacing: '4px', color: 'var(--text-secondary)' }}>
            ONE PLAN. EVERYTHING INCLUDED. NO SURPRISES.
          </p>
        </div>

        <div style={{
          maxWidth: '440px',
          margin: '0 auto',
          padding: '60px',
          borderRadius: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--accent-blue)',
          boxShadow: '0 0 80px rgba(74,158,255,0.08)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '11px',
            letterSpacing: '4px',
            color: 'var(--accent-blue)',
            marginBottom: '24px',
          }}>DIALERSEAT PRO</div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '80px', fontWeight: 'bold', lineHeight: 1, color: 'var(--text-primary)' }}>$35</span>
            <span style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '12px' }}>/week</span>
          </div>

          <p style={{
            fontSize: '11px',
            letterSpacing: '3px',
            color: 'var(--text-secondary)',
            marginBottom: '16px',
          }}>PER SEAT · BILLED WEEKLY · CANCEL ANYTIME</p>

          <div style={{
            display: 'inline-block',
            padding: '8px 20px',
            borderRadius: '100px',
            background: 'rgba(74,158,255,0.1)',
            border: '1px solid var(--accent-blue)',
            fontSize: '11px',
            letterSpacing: '3px',
            color: 'var(--accent-blue)',
            marginBottom: '48px',
          }}>
            7-DAY FREE TRIAL · CARD REQUIRED
          </div>

          <div style={{ marginBottom: '48px', textAlign: 'left' }}>
            {[
              'Unlimited outbound calling',
              'Unlimited lead uploads',
              'Up to 5 simultaneous campaigns',
              'Live analytics dashboard',
              'Call recordings included',
              'Your data saved forever',
              'Team seat management',
              'No setup fees ever',
            ].map((feature, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '20px',
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'rgba(74,158,255,0.1)',
                  border: '1px solid var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>✓</span>
                </div>
                <span style={{ fontSize: '14px', letterSpacing: '1px', color: 'var(--text-secondary)' }}>{feature}</span>
              </div>
            ))}
          </div>

          <Link href="/sign-up" style={{
            display: 'block',
            padding: '18px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: 'white',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            boxShadow: '0 0 30px rgba(74,158,255,0.3)',
            marginBottom: '16px',
          }}>
            START FREE TRIAL
          </Link>
          <p style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-secondary)' }}>
            CARD REQUIRED · NO CHARGE FOR 7 DAYS
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{
        padding: '120px 60px',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: '52px',
          fontWeight: 'bold',
          letterSpacing: '-1px',
          color: 'var(--text-primary)',
          marginBottom: '24px',
          lineHeight: '1.1',
        }}>
          STOP PAYING TOO MUCH.<br />
          <span style={{
            background: 'linear-gradient(135deg, #4a9eff, #a0c4ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>START CLOSING MORE.</span>
        </h2>
        <p style={{
          fontSize: '16px',
          letterSpacing: '1px',
          color: 'var(--text-secondary)',
          marginBottom: '48px',
          lineHeight: '1.8',
        }}>
          Join the dialer that is built for the people actually making the calls. No fluff, no bloat, no contracts. Just pure dialing power at a price that makes sense.
        </p>
        <Link href="/sign-up" style={{
          display: 'inline-block',
          padding: '20px 60px',
          borderRadius: '14px',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          color: 'white',
          textDecoration: 'none',
          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
          boxShadow: '0 0 60px rgba(74,158,255,0.4)',
        }}>
          GET STARTED FREE
        </Link>
        <p style={{ marginTop: '20px', fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
          7 DAYS FREE · THEN $35/WEEK · CANCEL ANYTIME
        </p>
      </section>

      {/* FOOTER */}
      <footer style={{
        padding: '40px 60px',
        textAlign: 'center',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>D</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '6px', color: 'var(--text-primary)' }}>DIALERSEAT</span>
        </div>
        <p style={{ fontSize: '11px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
          © {new Date().getFullYear()} DIALERSEAT · ALL RIGHTS RESERVED
        </p>
      </footer>

    </main>
  );
}