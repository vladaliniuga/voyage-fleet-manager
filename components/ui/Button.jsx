// components/ui/Button.jsx
import React from 'react';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const SIZES = {
  sm: 'h-8 px-3 text-sm  rounded-md',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-base rounded-xl',
  xl: 'h-12 px-6 text-lg rounded-xl',
  square: 'h-8 aspect-square text-sm rounded-md',
};

// const SIZES = {
//   sm: 'py-1 px-3 text-sm rounded-md',
//   md: 'py-2 px-4 text-sm rounded-xl',
//   lg: 'py-3 px-5 text-base rounded-xl',
//   xl: 'py-4 px-6 text-lg rounded-xl',
//   square: 'h-8 aspect-square text-sm rounded-md',
// };

const VARIANTS = {
  // Solid / filled
  default: {
    default: 'bg-gray-900 text-white hover:bg-gray-700 shadow',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow',
    success: 'bg-green-600 text-white hover:bg-green-700 shadow',
    gray: 'bg-gray-200 text-gray-900 hover:bg-gray-300 shadow',
  },
  // Bordered
  outline: {
    default:
      'border border-gray-300 text-gray-900 bg-transparent hover:bg-gray-100',
    danger: 'border border-red-500 text-red-600 bg-transparent hover:bg-red-50',
    success:
      'border border-green-600 text-green-700 bg-transparent hover:bg-green-50',
    gray: 'border border-gray-300 text-gray-700 bg-transparent hover:bg-gray-100',
  },
  // Text-like with subtle hover
  ghost: {
    default: 'text-gray-900 bg-transparent hover:bg-gray-100',
    danger: 'text-red-600 bg-transparent hover:bg-red-50',
    success: 'text-green-700 bg-transparent hover:bg-green-50',
    gray: 'text-gray-700 bg-transparent hover:bg-gray-100',
  },
  dark: {
    default: 'text-gray-900 bg-transparent hover:bg-gray-700 text-white',
    danger: 'text-red-600 bg-transparent hover:bg-red-50',
    success: 'text-green-700 bg-transparent hover:bg-green-50',
    gray: 'text-gray-700 bg-transparent hover:bg-gray-100',
  },
  outlineDark: {
    default:
      'border border-gray-300 text-white bg-transparent hover:bg-gray-100 hover:text-black hover:border-gray-100 ',
    danger: 'border border-red-500 text-red-600 bg-transparent hover:bg-red-50',
    success:
      'border border-green-600 text-green-700 bg-transparent hover:bg-green-50',
    gray: 'border border-gray-300 text-gray-700 bg-transparent hover:bg-gray-100',
  },
  defaultDark: {
    default: 'bg-gray-100 text-black hover:bg-gray-300 shadow',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow',
    success: 'bg-green-600 text-white hover:bg-green-700 shadow',
    gray: 'bg-gray-200 text-gray-900 hover:bg-gray-300 shadow',
  },
};

export default function Button({
  as: As = 'button',
  variant = 'default', // 'default' | 'outline' | 'ghost'
  color = 'default', // 'default' | 'danger' | 'success' | 'gray'
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  className = '',
  disabled = false,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-medium transition ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ' +
    'disabled:opacity-50 disabled:pointer-events-none select-none';

  const sizeCls = SIZES[size] || SIZES.md;
  const variantSet = VARIANTS[variant] || VARIANTS.default;
  const colorCls = variantSet[color] || variantSet.default;

  return (
    <As
      className={cx(base, sizeCls, colorCls, className)}
      disabled={disabled}
      {...props}
    />
  );
}
