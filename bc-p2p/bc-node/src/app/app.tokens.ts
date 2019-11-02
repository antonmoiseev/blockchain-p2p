import { InjectionToken } from '@angular/core';
import { environment } from '../environments/environment';

export const SIGNALING_SERVER_URL = new InjectionToken('SIGNALING_SERVER_URL', {
  factory: () => environment.signalingServerUrl,
  providedIn: 'root'
});
