// Drop-in replacement for React Native's Alert. On phones it is the native dialog;
// in the browser (react-native-web makes Alert.alert a no-op) it falls back to
// window.alert / window.confirm so messages and confirm buttons still work.
import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

function webAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length < 2) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  // Two-choice dialog: OK runs the non-cancel action, Cancel runs the cancel button.
  const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
  const action = [...buttons].reverse().find((b) => b !== cancel) ?? buttons[buttons.length - 1];
  if (window.confirm(`${text}\n\nOK = ${action.text ?? 'OK'} · Cancel = ${cancel.text ?? 'Cancel'}`)) action.onPress?.();
  else cancel.onPress?.();
}

export const Alert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) =>
    Platform.OS === 'web' ? webAlert(title, message, buttons) : NativeAlert.alert(title, message, buttons),
};
