import { Component, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './app-button.html',
  styleUrl: './app-button.scss',
})
export class AppButtonComponent {
  variant = input<ButtonVariant>('primary');
  size    = input<ButtonSize>('md');
  loading = input(false);
  disabled = input(false);
  type    = input<'button' | 'submit' | 'reset'>('button');

  btnClass = computed(() => `btn btn--${this.variant()} btn--${this.size()}`);
  isDisabled = computed(() => this.disabled() || this.loading());
}
