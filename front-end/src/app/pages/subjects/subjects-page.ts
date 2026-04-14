import { Component, OnInit, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Subject } from '../../models/api.models';

@Component({
  selector: 'app-subjects-page',
  standalone: true,
  templateUrl: './subjects-page.html',
  styleUrl: './subjects-page.css',
})
export class SubjectsPage implements OnInit {
  private api = inject(ApiService);

  subjects: Subject[] = [];
  errorMessage = '';

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    this.api.getSubjects().subscribe({
      next: (data) => {
        this.subjects = data;
        this.errorMessage = '';
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.errorMessage = 'Failed to load subjects';
      },
    });
  }
}
