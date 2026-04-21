import React, { useState, useRef, useEffect } from 'react';
import './ContextMenu.css';

interface MenuItem {
    label: string;
    onClick: () => void;
}

interface ContextMenuProps {
    items: MenuItem[];
    children: React.ReactNode;
    onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, onContextMenu }) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        onContextMenu?.(e);
        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setVisible(true);
    };

    const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            setVisible(false);
        }
    };

    const handleItemClick = (onClick: () => void) => {
        onClick();
        setVisible(false);
    };

    useEffect(() => {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="context-menu-wrapper" onContextMenu={handleContextMenu}>
            {children}
            {visible && (
                <div
                    ref={menuRef}
                    className="context-menu"
                    style={{
                        top: position.y,
                        left: position.x,
                    }}
                >
                    {items.map((item, index) => (
                        <div
                            key={index}
                            className="context-menu-item"
                            onClick={() => handleItemClick(item.onClick)}
                        >
                            {item.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ContextMenu;