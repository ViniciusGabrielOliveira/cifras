import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
    value: string;
    label: string;
}

@Component({
    selector: 'app-select',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="wrap" [class.sm]="size === 'sm'">
            <select (change)="emit($event)">
                @if (placeholder) {
                    <option value="" [selected]="!value">{{ placeholder }}</option>
                }
                @for (o of opts; track o.value) {
                    <option [value]="o.value" [selected]="o.value === value">{{ o.label }}</option>
                }
            </select>
            <svg class="chevron" width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="6 9 12 15 18 9"/>
            </svg>
        </div>
    `,
    styleUrl: './app-select.scss',
})
export class AppSelectComponent {
    opts: SelectOption[] = [];

    @Input() set options(v: Array<string | SelectOption>) {
        this.opts = v.map(o => typeof o === 'string' ? { value: o, label: o } : o);
    }

    @Input() value = '';
    @Input() size: 'sm' | 'md' = 'md';
    @Input() placeholder = '';
    @Output() valueChange = new EventEmitter<string>();

    emit(event: Event) {
        this.valueChange.emit((event.target as HTMLSelectElement).value);
    }
}
