import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);

  isBootstrapping = signal(true);

  ngOnInit(): void {
    const token = this.auth.getToken();

    if (!token) {
      this.isBootstrapping.set(false);
      return;
    }

    this.auth.loadMe().subscribe({
      next: () => {
        this.isBootstrapping.set(false);
      },
      error: () => {
        this.auth.logout();
        this.isBootstrapping.set(false);
        this.router.navigateByUrl('/login');
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
