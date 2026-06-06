import { Component, input, output } from '@angular/core';

@Component({
    selector: 'app-toggle',
    standalone: true,
    templateUrl: './toggle.html',
    styleUrl: './toggle.scss',
})
export class ToggleComponent {
    checked = input<boolean>(false);
    label = input<string>('');
    color = input<string>('');
    title = input<string>('');

    changed = output<void>();
}
