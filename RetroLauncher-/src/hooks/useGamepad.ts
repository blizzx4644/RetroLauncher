import { useEffect, useCallback, useRef } from 'react';

export interface GamepadState {
  connected: boolean;
  index: number;
  id: string;
}

export interface GamepadCallbacks {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onA?: () => void; // Button 0 (A/Cross)
  onB?: () => void; // Button 1 (B/Circle)
  onX?: () => void; // Button 2 (X/Square)
  onY?: () => void; // Button 3 (Y/Triangle)
  onStart?: () => void; // Button 9
  onSelect?: () => void; // Button 8
  onLB?: () => void; // Button 4
  onRB?: () => void; // Button 5
  onLT?: () => void; // Button 6 (Left Trigger)
  onRT?: () => void; // Button 7 (Right Trigger)
}

const AXIS_THRESHOLD = 0.5;
const BUTTON_THRESHOLD = 0.5;
const INPUT_DELAY = 150; // ms between inputs to prevent spam

export const useGamepad = (callbacks: GamepadCallbacks) => {
  const gamepadRef = useRef<GamepadState>({ connected: false, index: -1, id: '' });
  const lastInputTime = useRef<number>(0);
  const buttonStates = useRef<boolean[]>([]);
  const axisStates = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const handleGamepadInput = useCallback(() => {
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[gamepadRef.current.index];

    if (!gamepad) return;

    const now = Date.now();
    if (now - lastInputTime.current < INPUT_DELAY) return;

    // Handle D-pad and analog stick (axes)
    const leftX = gamepad.axes[0] || 0;
    const leftY = gamepad.axes[1] || 0;

    // Left
    if (leftX < -AXIS_THRESHOLD && !axisStates.current.left) {
      axisStates.current.left = true;
      callbacks.onLeft?.();
      lastInputTime.current = now;
    } else if (leftX >= -AXIS_THRESHOLD) {
      axisStates.current.left = false;
    }

    // Right
    if (leftX > AXIS_THRESHOLD && !axisStates.current.right) {
      axisStates.current.right = true;
      callbacks.onRight?.();
      lastInputTime.current = now;
    } else if (leftX <= AXIS_THRESHOLD) {
      axisStates.current.right = false;
    }

    // Up
    if (leftY < -AXIS_THRESHOLD && !axisStates.current.up) {
      axisStates.current.up = true;
      callbacks.onUp?.();
      lastInputTime.current = now;
    } else if (leftY >= -AXIS_THRESHOLD) {
      axisStates.current.up = false;
    }

    // Down
    if (leftY > AXIS_THRESHOLD && !axisStates.current.down) {
      axisStates.current.down = true;
      callbacks.onDown?.();
      lastInputTime.current = now;
    } else if (leftY <= AXIS_THRESHOLD) {
      axisStates.current.down = false;
    }

    // Handle buttons
    gamepad.buttons.forEach((button, index) => {
      const pressed = button.pressed || button.value > BUTTON_THRESHOLD;
      const wasPressed = buttonStates.current[index] || false;

      if (pressed && !wasPressed) {
        lastInputTime.current = now;

        switch (index) {
          case 0: // A button
            callbacks.onA?.();
            break;
          case 1: // B button
            callbacks.onB?.();
            break;
          case 2: // X button
            callbacks.onX?.();
            break;
          case 3: // Y button
            callbacks.onY?.();
            break;
          case 4: // LB
            callbacks.onLB?.();
            break;
          case 5: // RB
            callbacks.onRB?.();
            break;
          case 6: // LT (Left Trigger)
            callbacks.onLT?.();
            break;
          case 7: // RT (Right Trigger)
            callbacks.onRT?.();
            break;
          case 8: // Select/Back
            callbacks.onSelect?.();
            break;
          case 9: // Start
            callbacks.onStart?.();
            break;
          case 12: // D-pad up
            callbacks.onUp?.();
            break;
          case 13: // D-pad down
            callbacks.onDown?.();
            break;
          case 14: // D-pad left
            callbacks.onLeft?.();
            break;
          case 15: // D-pad right
            callbacks.onRight?.();
            break;
        }
      }

      buttonStates.current[index] = pressed;
    });
  }, [callbacks]);

  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
      gamepadRef.current = {
        connected: true,
        index: e.gamepad.index,
        id: e.gamepad.id,
      };
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      if (gamepadRef.current.index === e.gamepad.index) {
        gamepadRef.current = {
          connected: false,
          index: -1,
          id: '',
        };
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Check for already connected gamepads
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        gamepadRef.current = {
          connected: true,
          index: i,
          id: gamepads[i]!.id,
        };
        break;
      }
    }

    // Poll gamepad state
    const pollInterval = setInterval(handleGamepadInput, 16); // ~60fps

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      clearInterval(pollInterval);
    };
  }, [handleGamepadInput]);

  return gamepadRef.current;
};
