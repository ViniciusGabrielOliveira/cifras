import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-segmented-control',
  standalone: true,
  templateUrl: './app-segmented-control.html',
  styleUrl: './app-segmented-control.scss',
})
export class AppSegmentedControlComponent {
  options = input.required<string[]>();
  value   = input.required<string>();

  changed = output<string>();
}
