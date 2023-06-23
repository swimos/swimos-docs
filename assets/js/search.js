function selectConfigs() {
    return {
        filter: '',
        show: false,
        selected: null,
        focusedOptionIndex: null,
        options: null,
        close() {
            this.show = false;
            this.filter = this.selectedPage();
            this.focusedOptionIndex = this.selected ? this.focusedOptionIndex : null;
        },
        open() {
            this.show = true;
            this.filter = '';
        },
        toggle() {
            if (this.show) {
                this.close();
            }
            else {
                this.open()
            }
        },
        isOpen() { return this.show === true },
        selectedPage() {
            return this.selected ? this.selected.title : this.filter;
            //window.location.href = this.selected.url;
            //window.location.href = this.selected ? this.selected.url : this.filter;
        },
        classOption(id, index) {
            const isSelected = this.selected ? (id == this.selected.title) : false;
            const isFocused = (index == this.focusedOptionIndex);
            return {
                'cursor-pointer w-full border-gray-100 border-b hover:bg-blue-50': true,
                'bg-blue-100': isSelected,
                'bg-blue-50': isFocused
            };
        },
        fetchOptions() {
            let url = window.location.origin + '/search.json'
            fetch(url)
                .then(response => response.json())
                .then(data => this.options = data);
        },
        filteredOptions() {
            return this.options
                ? this.options.filter(option => {
                    return (option.title.toLowerCase().indexOf(this.filter) > -1)
                        || (option.excerpt.toLowerCase().indexOf(this.filter) > -1)
                })
                : {}
        },
        onOptionClick(index) {
            this.focusedOptionIndex = index;
            this.selectOption();
        },
        selectOption() {
            if (!this.isOpen()) {
                return;
            }
            this.focusedOptionIndex = this.focusedOptionIndex ?? 0;
            const selected = this.filteredOptions()[this.focusedOptionIndex]
            this.selected = selected;
            this.filter = this.selectedPage();
            window.location.href = this.selected.url;
            this.close();
        },
        focusPrevOption() {
            if (!this.isOpen()) {
                return;
            }
            const optionsNum = Object.keys(this.filteredOptions()).length - 1;
            if (this.focusedOptionIndex > 0 && this.focusedOptionIndex <= optionsNum) {
                this.focusedOptionIndex--;
            }
            else if (this.focusedOptionIndex == 0) {
                this.focusedOptionIndex = optionsNum;
            }
        },
        focusNextOption() {
            const optionsNum = Object.keys(this.filteredOptions()).length - 1;
            if (!this.isOpen()) {
                this.open();
            }
            if (this.focusedOptionIndex == null || this.focusedOptionIndex == optionsNum) {
                this.focusedOptionIndex = 0;
            }
            else if (this.focusedOptionIndex >= 0 && this.focusedOptionIndex < optionsNum) {
                this.focusedOptionIndex++;
            }
        }
    }
}