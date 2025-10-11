import { useEffect } from 'react';
import { useHistory } from '@docusaurus/router';

export default function Home() {
  const history = useHistory();

  useEffect(() => {
    // Redirect to the intro page
    history.replace('/intro');
  }, [history]);

  return <div>Redirecting to documentation...</div>;
}
