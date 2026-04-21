import { Component, OnInit, inject } from '@angular/core';
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

  ngOnInit(): void {
    const token = this.auth.getToken();

    if (!token) {
      return;
    }

    this.auth.loadMe().subscribe({
      error: () => {
        this.auth.logout();
        this.router.navigateByUrl('/login');
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
