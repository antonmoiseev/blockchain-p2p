import { Component } from '@angular/core';
import { SignalingService } from './shared/services/signaling.service';

@Component({
  selector: 'bc-app',
  template: `
    <button (click)="broadcast()">Broadcast</button>
  `
})
export class AppComponent {
  constructor(private readonly signalingService: SignalingService) {
    this.signalingService.connect();
  }

  broadcast() {
    this.signalingService.broadcast();
  }
}
