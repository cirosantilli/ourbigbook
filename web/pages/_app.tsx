import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect } from 'react';

import { googleAnalyticsId, isProduction } from 'front/config';
import CustomLink from 'front/CustomLink'
import Navbar from 'front/Navbar'
import { AppContext, AppContextProvider } from 'front'
import { appName } from 'front/config'

// Css
// migrating the local ourbigbook to webpack: https://github.com/cirosantilli/ourbigbook/issues/157
import 'ourbigbook/dist/ourbigbook.css'
import 'ourbigbook/editor.scss'
import 'ionicons/css/ionicons.min.css'
import 'style.scss'

function MyHead() {
  const { title } = React.useContext(AppContext)
  let realTitle = title === undefined ? '' : title + ' - '
  return (
    <Head>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1"
      />
      <title>{realTitle + appName}</title>
    </Head>
  )
}

function handleRouteChange(url) {
  window.gtag('config', googleAnalyticsId, {
    page_path: url,
  })
}

const MyApp = ({ Component, pageProps }) => {
  if (isProduction) {
    // Google Analytics page switches:
    // https://stackoverflow.com/questions/60411351/how-to-use-google-analytics-with-next-js-app/62552263#62552263
    const router = useRouter();
    useEffect(() => {
      router.events.on('routeChangeComplete', handleRouteChange);
      return () => {
        router.events.off('routeChangeComplete', handleRouteChange);
      };
    }, [router.events]);
  }

  const isEditor = !!Component.isEditor
  return (
    <AppContextProvider>
      <MyHead />
      <div className={`toplevel${isEditor ? ' editor' : ''}`}>
        <Navbar />
        <div className="main">
          <Component {...pageProps} />
        </div>
        {!isEditor &&
          <footer>
            <div className="container">
              Content license <a href="https://cirosantilli.com/ourbigbook-com/content-license">CC BY-SA 4.0 unless noted</a>  |
              {' '}<a href="https://github.com/cirosantilli/ourbigbook/tree/master/web">Website source code</a> |
              {' '}<a href="https://github.com/cirosantilli/ourbigbook/issues">Contact, bugs, suggestions, abuse reports</a>
            </div>
          </footer>
        }
      </div>
    </AppContextProvider>
  )
}

export default MyApp;
