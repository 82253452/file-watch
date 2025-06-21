/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // 科技感主题色系
                'tech': {
                    primary: '#06b6d4',       // 主蓝青色 (用于主要交互元素)
                    'primary-light': '#67e8f9', // 浅主色
                    'primary-dark': '#0891b2',  // 深主色
                    secondary: '#0e7490',      // 次要色
                    dark: '#0f172a',           // 深背景色
                    darker: '#020617',         // 最暗背景
                    accent: '#3b82f6',         // 强调色
                    'accent-dark': '#2563eb',  // 深强调色
                },
                // 扩展的状态色
                'state': {
                    active: '#10b981',        // 活跃状态
                    warning: '#f59e0b',       // 警告状态
                    error: '#ef4444',         // 错误状态
                    success: '#22c55e',       // 成功状态
                }
            },
            fontFamily: {
                // 科技感字体配置
                'tech': ['"Share Tech Mono"', 'monospace'],
                'digital': ['"Digital-7"', 'monospace'], // 数码管字体
            },
            animation: {
                // 自定义动画
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'scanline': 'scanline 8s linear infinite',
            },
            keyframes: {
                // 发光效果
                glow: {
                    '0%, 100%': {
                        'text-shadow': '0 0 10px rgba(6, 182, 212, 0.7)',
                        'box-shadow': '0 0 10px rgba(6, 182, 212, 0.5)'
                    },
                    '50%': {
                        'text-shadow': '0 0 15px rgba(6, 182, 212, 0.9)',
                        'box-shadow': '0 0 15px rgba(6, 182, 212, 0.8)'
                    }
                },
                // 扫描线效果
                scanline: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100%)' },
                }
            },
            boxShadow: {
                // 科技感阴影
                'tech-sm': '0 0 8px rgba(6, 182, 212, 0.3)',
                'tech-md': '0 0 15px rgba(6, 182, 212, 0.4)',
                'tech-lg': '0 0 25px rgba(6, 182, 212, 0.5)',
                'tech-inner': 'inset 0 0 10px rgba(6, 182, 212, 0.3)',
            },
            // 扩展边框样式
            borderWidth: {
                '3': '3px',
                '5': '5px',
            },
            // 自定义渐变
            backgroundImage: {
                'tech-radial': 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, rgba(14,116,144,0.1) 100%)',
                'tech-linear': 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(14,116,144,0.2) 100%)',
            }
        },
    },
    plugins: [

    ],
}