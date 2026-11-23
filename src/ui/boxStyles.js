// ANSI escape helpers without external dependencies
const ESC = '\x1b[';

export const colors = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  cyan: `${ESC}36m`,
  yellow: `${ESC}33m`,
  green: `${ESC}32m`,
  red: `${ESC}31m`,
  magenta: `${ESC}35m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`
};

export const box = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│'
};
