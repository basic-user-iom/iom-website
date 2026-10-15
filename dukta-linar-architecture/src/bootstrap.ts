import {startup} from './LoadingScreen';
void import('./main').catch(() => startup.fail('The viewer files could not be loaded. Check your connection and try again.'));
