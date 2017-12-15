import * as React from 'react';
import { IDropdownProps, IDropdownOption, DropdownMenuItemType } from './Dropdown.types';
import { Checkbox } from '../../Checkbox';
import { DirectionalHint } from '../../common/DirectionalHint';
import { Callout } from '../../Callout';
import { Label } from '../../Label';
import { CommandButton } from '../../Button';
import { Panel } from '../../Panel';
import { Icon } from '../../Icon';
import { FocusZone, FocusZoneDirection } from '../../FocusZone';
import { withResponsiveMode, ResponsiveMode } from '../../utilities/decorators/withResponsiveMode';
import { IWithResponsiveModeState } from '../../utilities/decorators/withResponsiveMode';
import {
  BaseComponent,
  KeyCodes,
  autobind,
  css,
  findIndex,
  getId,
  getNativeProps,
  divProperties,
  getFirstFocusable,
  getLastFocusable
} from '../../Utilities';
import { SelectableOptionMenuItemType } from '../../utilities/selectableOption/SelectableOption.types';
import * as stylesImport from './Dropdown.scss';
const styles: any = stylesImport;
import { getStyles as getCheckboxStyles } from '../Checkbox/Checkbox.styles';
import { getTheme } from '../../Styling';

// Internal only props interface to support mixing in responsive mode
export interface IDropdownInternalProps extends IDropdownProps, IWithResponsiveModeState {

}

export interface IDropdownState {
  isOpen?: boolean;
  selectedIndices?: number[];
}

@withResponsiveMode
export class Dropdown extends BaseComponent<IDropdownInternalProps, IDropdownState> {

  public static defaultProps = {
    options: [] as any[]
  };

  private static Option: string = 'option';

  private _root: HTMLElement;
  private _host: HTMLDivElement;
  private _focusZone: FocusZone;
  private _dropDown: HTMLDivElement;
  // tslint:disable-next-line:no-unused-variable
  private _dropdownLabel: HTMLElement;
  private _id: string;
  private _isScrollIdle: boolean;
  private readonly _scrollIdleDelay: number = 250 /* ms */;
  private _scrollIdleTimeoutId: number | undefined;

  constructor(props: IDropdownProps) {
    super(props);
    props.options.forEach((option: any) => {
      if (!option.itemType) {
        option.itemType = DropdownMenuItemType.Normal;
      }
    });
    super(props);

    this._warnDeprecations({
      'isDisabled': 'disabled'
    });

    this._warnMutuallyExclusive({
      'defaultSelectedKey': 'selectedKey',
      'defaultSelectedKeys': 'selectedKeys',
      'selectedKeys': 'selectedKey',
      'multiSelect': 'defaultSelectedKey',
      'selectedKey': 'multiSelect'
    });

    this._id = props.id || getId('Dropdown');
    this._isScrollIdle = true;

    this.state = {
      isOpen: false
    };
    if (this.props.multiSelect) {
      let selectedKeys = props.defaultSelectedKeys !== undefined ? props.defaultSelectedKeys : props.selectedKeys;
      this.state = {
        selectedIndices: this._getSelectedIndexes(props.options, selectedKeys)
      };
    } else {
      let selectedKey = props.defaultSelectedKey !== undefined ? props.defaultSelectedKey : props.selectedKey;
      this.state = {
        selectedIndices: this._getSelectedIndexes(props.options, selectedKey!)
      };
    }

  }

  public componentWillReceiveProps(newProps: IDropdownProps) {
    // In controlled component usage where selectedKey is provided, update the selectedIndex
    // state if the key or options change.
    let selectedKeyProp: keyof IDropdownProps = this.props.multiSelect ? 'selectedKeys' : 'selectedKey';
    if (newProps[selectedKeyProp] !== undefined &&
      (newProps[selectedKeyProp] !== this.props[selectedKeyProp] || newProps.options !== this.props.options)) {
      this.setState({
        selectedIndices: this._getSelectedIndexes(newProps.options, newProps[selectedKeyProp])
      });
    }
  }

  public componentDidUpdate(prevProps: IDropdownProps, prevState: IDropdownState) {
    if (prevState.isOpen === true && this.state.isOpen === false) {
      this._dropDown.focus();

      if (this.props.onDismiss) {
        this.props.onDismiss();
      }
    }
  }

  // Primary Render
  public render() {
    let id = this._id;
    let {
      className,
      label,
      options,
      disabled,
      isDisabled,
      ariaLabel,
      required,
      errorMessage,
      onRenderTitle = this._onRenderTitle,
      onRenderContainer = this._onRenderContainer,
      onRenderPlaceHolder = this._onRenderPlaceHolder,
      onRenderCaretDown = this._onRenderCaretDown
    } = this.props;
    let { isOpen, selectedIndices = [] } = this.state;
    let selectedOptions = this._getAllSelectedOptions(options, selectedIndices);
    let divProps = getNativeProps(this.props, divProperties);

    // Remove this deprecation workaround at 1.0.0
    if (isDisabled !== undefined) {
      disabled = isDisabled;
    }

    return (
      <div ref={ this._resolveRef('_root') } className={ css('ms-Dropdown-container') }>
        { label && (
          <Label className={ css('ms-Dropdown-label') } id={ id + '-label' } htmlFor={ id } ref={ this._resolveRef('_dropdownLabel') } required={ required }>{ label }</Label>
        ) }
        <div
          data-is-focusable={ !disabled }
          ref={ this._resolveRef('_dropDown') }
          id={ id }
          tabIndex={ disabled ? -1 : 0 }
          aria-expanded={ isOpen ? 'true' : 'false' }
          role='combobox'
          aria-readonly='true'
          aria-live={ disabled || isOpen ? 'off' : 'assertive' }
          aria-label={ ariaLabel }
          aria-describedby={ id + '-option' }
          aria-activedescendant={ isOpen && selectedIndices.length === 1 && selectedIndices[0] >= 0 ? (this._id + '-list' + selectedIndices[0]) : null }
          aria-disabled={ disabled }
          aria-owns={ isOpen ? id + '-list' : null }
          { ...divProps }
          className={ css(
            'ms-Dropdown',
            styles.root,
            className,
            isOpen! && 'is-open',
            disabled! && ('is-disabled ' + styles.rootIsDisabled),
            required! && 'is-required',
          ) }
          onBlur={ this._onDropdownBlur }
          onKeyDown={ this._onDropdownKeyDown }
          onKeyUp={ this._onDropdownKeyUp }
          onClick={ this._onDropdownClick }
        >
          <span
            id={ id + '-option' }
            className={ css(
              'ms-Dropdown-title', styles.title,
              !selectedOptions.length && 'ms-Dropdown-titleIsPlaceHolder',
              !selectedOptions.length && styles.titleIsPlaceHolder,
              (errorMessage && errorMessage.length > 0 ? styles.titleIsError : null))
            }
            aria-atomic={ true }
            role='textbox'
            aria-readonly='true'
          >
            { // If option is selected render title, otherwise render the placeholder text
              selectedOptions.length ? (
                onRenderTitle(selectedOptions, this._onRenderTitle)
              ) :
                onRenderPlaceHolder(this.props, this._onRenderPlaceHolder)
            }
          </span>
          <span className={ css('ms-Dropdown-caretDownWrapper', styles.caretDownWrapper) }>
            { onRenderCaretDown(this.props, this._onRenderCaretDown) }
          </span>
        </div>
        { isOpen && (
          onRenderContainer(this.props, this._onRenderContainer)
        ) }
        {
          errorMessage &&
          <div
            className={ css(styles.errorMessage) }
          >
            { errorMessage }
          </div>
        }
      </div>
    );
  }

  public focus(shouldOpenOnFocus?: boolean) {
    if (this._dropDown && this._dropDown.tabIndex !== -1) {
      this._dropDown.focus();
      if (shouldOpenOnFocus) {
        this.setState({
          isOpen: true
        });
      }
    }
  }

  public setSelectedIndex(index: number) {
    let { onChanged, options, selectedKey, selectedKeys, multiSelect } = this.props;
    let { selectedIndices = [] } = this.state;
    let checked: boolean = selectedIndices ? selectedIndices.indexOf(index) > -1 : false;

    index = Math.max(0, Math.min(options.length - 1, index));

    if (!multiSelect && index === selectedIndices[0]) {
      return;
    } else if (!multiSelect && selectedKey === undefined) {
      // Set the selected option if this is an uncontrolled component
      this.setState({
        selectedIndices: [index]
      });
    } else if (multiSelect && selectedKeys === undefined) {
      let newIndexes = selectedIndices ? this._copyArray(selectedIndices) : [];
      if (checked) {
        let position = newIndexes.indexOf(index);
        if (position > -1) {
          // unchecked the current one
          newIndexes.splice(position, 1);
        }
      } else {
        // add the new selected index into the existing one
        newIndexes.push(index);
      }
      this.setState({
        selectedIndices: newIndexes
      });
    }

    if (onChanged) {
      // for single-select, option passed in will always be selected.
      // for multi-select, flip the checked value
      let changedOpt = multiSelect ? { ...options[index], selected: !checked } : options[index];
      onChanged(changedOpt, index);
    }
  }

  private _copyArray(array: any[]): any[] {
    let newArray = [];
    for (let element of array) {
      newArray.push(element);
    }
    return newArray;
  }

  /**
   * Finds the next valid Dropdown option and sets the selected index to it.
   * @param stepValue Value of how many items the function should traverse.  Should be -1 or 1.
   * @param index Index of where the search should start
   * @param selectedIndex The selectedIndex Dropdown's state
   * @returns The next valid dropdown option's index
   */
  private _moveIndex(stepValue: number, index: number, selectedIndex: number): number {
    const { options } = this.props;
    // Return selectedIndex if nothing has changed or options is empty
    if (selectedIndex === index || options.length === 0) {
      return selectedIndex;
    }

    // Set starting index to 0 if index is < 0
    if (index < 0) {
      index = 0;
    }
    // Set starting index to last option index if greater than options.length
    if (index >= options.length) {
      index = options.length - 1;
    }
    let stepCounter = 0;
    // If current index is a header or divider, increment by step
    while (options[index].itemType === DropdownMenuItemType.Header || options[index].itemType === DropdownMenuItemType.Divider) {
      // If stepCounter exceeds length of options, then return selectedIndex (-1)
      if (stepCounter >= options.length) {
        return selectedIndex;
      }
      // If index + stepValue is out of bounds, wrap around
      if (index + stepValue < 0) {
        index = options.length;
      } else if (index + stepValue >= options.length) {
        index = -1;
      }

      index = index + stepValue;
      stepCounter++;
    }

    this.setSelectedIndex(index);
    return index;
  }

  // Render text in dropdown input
  @autobind
  private _onRenderTitle(item: IDropdownOption[]): JSX.Element {
    let { multiSelectDelimiter = ', ' } = this.props;

    let displayTxt = item.map(i => i.text).join(multiSelectDelimiter);
    return <span>{ displayTxt }</span>;
  }

  // Render placeHolder text in dropdown input
  @autobind
  private _onRenderPlaceHolder(props: IDropdownProps): JSX.Element | null {
    if (!props.placeHolder) {
      return null;
    }
    return <span>{ props.placeHolder }</span>;
  }

  // Render Callout or Panel container and pass in list
  @autobind
  private _onRenderContainer(props: IDropdownProps): JSX.Element {
    let {
      onRenderList = this._onRenderList,
      responsiveMode,
      calloutProps,
      dropdownWidth
    } = this.props;

    let isSmall = responsiveMode! <= ResponsiveMode.medium;

    return (
      isSmall ?
        (
          <Panel
            className={ css('ms-Dropdown-panel', styles.panel) }
            isOpen={ true }
            isLightDismiss={ true }
            onDismissed={ this._onDismiss }
            hasCloseButton={ false }
          >
            { onRenderList(props, this._onRenderList) }
          </Panel>
        )
        :
        (
          <Callout
            isBeakVisible={ false }
            gapSpace={ 0 }
            doNotLayer={ false }
            directionalHintFixed={ true }
            directionalHint={ DirectionalHint.bottomLeftEdge }
            { ...calloutProps }
            className={ css('ms-Dropdown-callout', styles.callout, calloutProps ? calloutProps.className : undefined) }
            target={ this._dropDown }
            onDismiss={ this._onDismiss }
            onScroll={ this._onScroll }
            onPositioned={ this._onPositioned }
            calloutWidth={ dropdownWidth || this._dropDown.clientWidth }
          >
            { onRenderList(props, this._onRenderList) }
          </Callout>
        )
    );
  }

  // Render Caret Down Icon
  @autobind
  private _onRenderCaretDown(props: IDropdownProps): JSX.Element {
    return (
      <Icon className={ css('ms-Dropdown-caretDown', styles.caretDown) } iconName='ChevronDown' />
    );
  }

  // Render List of items
  @autobind
  private _onRenderList(props: IDropdownProps): JSX.Element {
    let {
      onRenderItem = this._onRenderItem
    } = this.props;

    let id = this._id;
    let { selectedIndices = [] } = this.state;

    return (
      <div
        className={ styles.listWrapper }
        onKeyDown={ this._onZoneKeyDown }
        ref={ this._resolveRef('_host') }
        tabIndex={ 0 }
      >
        <FocusZone
          ref={ this._resolveRef('_focusZone') }
          direction={ FocusZoneDirection.vertical }
          defaultActiveElement={ selectedIndices[0] !== undefined ? `#${id}-list${selectedIndices[0]}` : undefined }
          id={ id + '-list' }
          className={ css('ms-Dropdown-items', styles.items) }
          aria-labelledby={ id + '-label' }
          role='listbox'
        >
          { this.props.options.map((item: any, index: number) => onRenderItem({ ...item, index }, this._onRenderItem)) }
        </FocusZone>
      </div>
    );
  }

  // Render items
  @autobind
  private _onRenderItem(item: IDropdownOption): JSX.Element | null {
    switch (item.itemType) {
      case SelectableOptionMenuItemType.Divider:
        return this._renderSeparator(item);
      case SelectableOptionMenuItemType.Header:
        return this._renderHeader(item);
      default:
        return this._renderOption(item);
    }
  }

  // Render separator
  private _renderSeparator(item: IDropdownOption): JSX.Element | null {
    let { index, key } = item;
    if (index! > 0) {
      return (
        <div
          role='separator'
          key={ key }
          className={ css('ms-Dropdown-divider', styles.divider) }
        />
      );
    }
    return null;
  }

  private _renderHeader(item: IDropdownOption): JSX.Element {
    const { onRenderOption = this._onRenderOption } = this.props;
    const { key } = item;
    return (
      <div
        key={ key }
        className={ css('ms-Dropdown-header', styles.header) }
      >
        { onRenderOption(item, this._onRenderOption) }
      </div>);
  }

  // Render menu item
  @autobind
  private _renderOption(item: IDropdownOption): JSX.Element {
    let { onRenderOption = this._onRenderOption } = this.props;
    let { selectedIndices = [] } = this.state;
    let id = this._id;
    let isItemSelected = item.index !== undefined && selectedIndices ? selectedIndices.indexOf(item.index) > -1 : false;
    let checkboxStyles = getCheckboxStyles(getTheme());

    return (
      !this.props.multiSelect ?
        (
          <CommandButton
            id={ id + '-list' + item.index }
            ref={ Dropdown.Option + item.index }
            key={ item.key }
            data-index={ item.index }
            data-is-focusable={ true }
            className={ css(
              'ms-Dropdown-item', styles.item, {
                ['is-selected ' + styles.itemIsSelected]: isItemSelected,
                ['is-disabled ' + styles.itemIsDisabled]: this.props.disabled === true
              }
            ) }
            onClick={ this._onItemClick(item.index!) }
            onMouseEnter={ this._onItemMouseEnter.bind(this, item) }
            onMouseLeave={ this._onMouseItemLeave.bind(this, item) }
            onMouseMove={ this._onItemMouseMove.bind(this, item) }
            role='option'
            aria-selected={ isItemSelected ? 'true' : 'false' }
            ariaLabel={ item.ariaLabel || item.text }
            title={ item.text }
          >
            { onRenderOption(item, this._onRenderOption) }
          </CommandButton>
        ) : (
          <Checkbox
            id={ id + '-list' + item.index }
            ref={ Dropdown.Option + item.index }
            key={ item.key }
            data-index={ item.index }
            data-is-focusable={ true }
            onChange={ this._onItemClick(item.index!) }
            inputProps={ {
              onMouseEnter: this._onItemMouseEnter.bind(this, item),
              onMouseLeave: this._onMouseItemLeave.bind(this, item),
              onMouseMove: this._onItemMouseMove.bind(this, item)
            } }
            label={ item.text }
            className={ css(
              'ms-ColumnManagementPanel-checkbox',
              'ms-Dropdown-item', styles.item, {
                ['is-selected ' + styles.itemIsSelected]: isItemSelected,
                ['is-disabled ' + styles.itemIsDisabled]: isItemSelected
              }
            ) }
            role='option'
            aria-selected={ isItemSelected ? 'true' : 'false' }
            checked={ isItemSelected }
            // Hover is being handled by focus styles
            // so clear out the explicit hover styles
            styles={ {
              checkboxHovered: checkboxStyles.checkbox,
              checkboxCheckedHovered: checkboxStyles.checkboxChecked,
              textHovered: checkboxStyles.text
            } }
          >{ onRenderOption(item, this._onRenderOption) }
          </Checkbox>
        )
    );
  }

  // Render content of item (i.e. text/icon inside of button)
  @autobind
  private _onRenderOption(item: IDropdownOption): JSX.Element {
    return <span className={ css('ms-Dropdown-optionText', styles.optionText) }>{ item.text }</span>;
  }

  @autobind
  private _onPositioned() {
    this._focusZone.focus();
  }

  @autobind
  private _onItemClick(index: number): () => void {
    return (): void => {
      this.setSelectedIndex(index);
      if (!this.props.multiSelect) {
        // only close the callout when it's in single-select mode
        this.setState({
          isOpen: false
        });
      }
    };
  }

  /**
   * Scroll handler for the callout to make sure the mouse events
   * for updating focus are not interacting during scroll
   */
  @autobind
  private _onScroll() {
    if (!this._isScrollIdle && this._scrollIdleTimeoutId !== undefined) {
      this._async.clearTimeout(this._scrollIdleTimeoutId);
      this._scrollIdleTimeoutId = undefined;
    } else {
      this._isScrollIdle = false;
    }

    this._scrollIdleTimeoutId = this._async.setTimeout(() => { this._isScrollIdle = true; }, this._scrollIdleDelay);
  }

  private _onItemMouseEnter(item: any, ev: React.MouseEvent<HTMLElement>) {
    if (!this._isScrollIdle) {
      return;
    }

    let targetElement = ev.currentTarget as HTMLElement;
    targetElement.focus();
  }

  private _onItemMouseMove(item: any, ev: React.MouseEvent<HTMLElement>) {
    let targetElement = ev.currentTarget as HTMLElement;

    if (!this._isScrollIdle || document.activeElement === targetElement) {
      return;
    }

    targetElement.focus();
  }

  @autobind
  private _onMouseItemLeave(item: any, ev: React.MouseEvent<HTMLElement>) {
    if (!this._isScrollIdle) {
      return;
    }

    /**
     * IE11 focus() method forces parents to scroll to top of element.
     * Edge and IE expose a setActive() function for focusable divs that
     * sets the page focus but does not scroll the parent element.
     */
    if ((this._host as any).setActive) {
      (this._host as any).setActive();
    } else {
      this._host.focus();
    }
  }

  @autobind
  private _onDismiss() {
    this.setState({ isOpen: false });
    this._dropDown.focus();
  }

  // Get all selected indexes for multi-select mode
  private _getSelectedIndexes(options: IDropdownOption[], selectedKey: string | number | string[] | number[] | undefined): number[] {
    if (selectedKey === undefined) {
      if (this.props.multiSelect) {
        return this._getAllSelectedIndices(options);
      }
      let selectedIndex = this._getSelectedIndex(options, null);
      return selectedIndex !== -1 ? [selectedIndex] : [];
    } else if (!Array.isArray(selectedKey)) {
      return [this._getSelectedIndex(options, selectedKey)];
    }

    let selectedIndices: number[] = [];
    for (let key of selectedKey) {
      selectedIndices.push(this._getSelectedIndex(options, key));
    }
    return selectedIndices;
  }

  // Get all selected options for multi-select mode
  private _getAllSelectedOptions(options: IDropdownOption[], selectedIndices: number[]) {
    let selectedOptions: IDropdownOption[] = [];
    for (let index of selectedIndices) {
      const option = options[index];

      if (option) {
        selectedOptions.push(option);
      }
    }

    return selectedOptions;
  }

  private _getAllSelectedIndices(options: IDropdownOption[]): number[] {
    return options
      .map((option: IDropdownOption, index: number) => option.selected ? index : -1)
      .filter(index => index !== -1);

  }

  private _getSelectedIndex(options: IDropdownOption[], selectedKey: string | number | null): number {
    return findIndex(options, (option => {
      // tslint:disable-next-line:triple-equals
      if (selectedKey != null) {
        return option.key === selectedKey;
      } else {
        return !!option.isSelected || !!option.selected;
      }
    }));
  }

  @autobind
  private _onDropdownBlur(ev: React.FocusEvent<HTMLDivElement>) {
    if (this.state.isOpen) {
      // Do not onBlur when the callout is opened
      return;
    }
    if (this.props.onBlur) {
      this.props.onBlur(ev);
    }
  }

  @autobind
  private _onDropdownKeyDown(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(ev);
      if (ev.preventDefault) {
        return;
      }
    }
    let newIndex: number | undefined;
    const selectedIndex = this.state.selectedIndices!.length ? this.state.selectedIndices![0] : -1;

    switch (ev.which) {
      case KeyCodes.enter:
        this.setState({
          isOpen: !this.state.isOpen
        });
        break;

      case KeyCodes.escape:
        if (!this.state.isOpen) {
          return;
        }

        this.setState({
          isOpen: false
        });
        break;

      case KeyCodes.up:
        if (this.props.multiSelect) {
          this.setState({ isOpen: true });
        } else {
          newIndex = this._moveIndex(-1, selectedIndex - 1, selectedIndex);
        }
        break;

      case KeyCodes.down:
        if (ev.altKey || ev.metaKey || this.props.multiSelect) {
          this.setState({ isOpen: true });
        } else {
          newIndex = this._moveIndex(1, selectedIndex + 1, selectedIndex);
        }
        break;

      case KeyCodes.home:
        if (!this.props.multiSelect) {
          newIndex = this._moveIndex(1, 0, selectedIndex);
        }
        break;

      case KeyCodes.end:
        if (!this.props.multiSelect) {
          newIndex = this._moveIndex(-1, this.props.options.length - 1, selectedIndex);
        }
        break;

      case KeyCodes.space:
        // event handled in _onDropdownKeyUp
        break;

      default:
        return;
    }

    if (newIndex !== selectedIndex) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  @autobind
  private _onDropdownKeyUp(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (this.props.onKeyUp) {
      this.props.onKeyUp(ev);
      if (ev.preventDefault) {
        return;
      }
    }
    switch (ev.which) {
      case KeyCodes.space:
        this.setState({
          isOpen: !this.state.isOpen
        });
        break;

      default:
        return;
    }

    ev.stopPropagation();
    ev.preventDefault();
  }

  @autobind
  private _onZoneKeyDown(ev: React.KeyboardEvent<HTMLElement>) {
    let elementToFocus;

    switch (ev.which) {

      case KeyCodes.up:
        if (ev.altKey || ev.metaKey) {
          this.setState({ isOpen: false });
        } else {
          elementToFocus = getLastFocusable(this._host, (this._host.lastChild as HTMLElement), true);
        }
        break;

      // All directional keystrokes should be canceled when the zone is rendered.
      // This avoids the body scroll from reacting and thus dismissing the dropdown.
      case KeyCodes.home:
      case KeyCodes.end:
      case KeyCodes.pageUp:
      case KeyCodes.pageDown:
        break;

      case KeyCodes.down:
        elementToFocus = getFirstFocusable(this._host, (this._host.firstChild as HTMLElement), true);
        break;

      case KeyCodes.escape:
        this.setState({ isOpen: false });
        break;

      case KeyCodes.tab:
        this.setState({ isOpen: false });
        return;

      default:
        return;
    }

    if (elementToFocus) {
      elementToFocus.focus();
    }

    ev.stopPropagation();
    ev.preventDefault();
  }

  @autobind
  private _onDropdownClick(ev: React.MouseEvent<HTMLDivElement>) {
    if (this.props.onClick) {
      this.props.onClick(ev);
      if (ev.preventDefault) {
        return;
      }
    }
    let { disabled, isDisabled } = this.props;
    let { isOpen } = this.state;

    // Remove this deprecation workaround at 1.0.0
    if (isDisabled !== undefined) {
      disabled = isDisabled;
    }

    if (!disabled) {
      this.setState({
        isOpen: !isOpen
      });
    }
  }

}
