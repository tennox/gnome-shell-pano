#!/usr/bin/env nu

# Script to test Pano extension safely using various methods
# Supports both Xephyr (X11) and nested Wayland sessions

def main [method: string = "auto"] {
    print "🔗 Setting up test environment..."
    mkdir /tmp/gnome-shell-test-extensions
    rm -f /tmp/gnome-shell-test-extensions/pano@elhan.io
    ln -s $"($env.PWD)/dist" /tmp/gnome-shell-test-extensions/pano@elhan.io
    
    # Determine which method to use
    let test_method = if $method == "auto" {
        if (which gnome-shell | is-empty) {
            "none"
        } else {
            let gnome_version = (^gnome-shell --version | str trim | split row ' ' | get 1)
            if ($gnome_version | str starts-with "49") or ($gnome_version | str starts-with "50") {
                "xephyr"  # Use Xephyr for newer GNOME versions
            } else {
                "nested"  # Try nested for older versions
            }
        }
    } else {
        $method
    }
    
    match $test_method {
        "nested" => {
            test_nested_wayland
        },
        "xephyr" => {
            test_xephyr
        },
        "restart" => {
            test_restart_shell
        },
        "none" => {
            print "❌ GNOME Shell not found. Install using your package manager."
            exit 1
        },
        _ => {
            print $"❌ Unknown method: ($method)"
            print "Available methods: nested, xephyr, restart, auto"
            exit 1
        }
    }
}

def test_nested_wayland [] {
    print "🚀 Starting nested GNOME Shell (Wayland)..."
    print "   - Extensions directory: /tmp/gnome-shell-test-extensions"
    print "   - Press Alt+F2 and type 'r' to restart shell if needed"
    print "   - Use Ctrl+Alt+Shift+R to enable looking glass for debugging"
    print "   - Close the nested window to exit"
    
    $env.GNOME_SHELL_EXTENSION_DIR = "/tmp/gnome-shell-test-extensions"
    $env.MUTTER_DEBUG_DUMMY_MODE_SPECS = "1200x800"
    $env.MUTTER_DEBUG_DUMMY_MONITOR_SCALES = "1"
    
    try {
        ^dbus-run-session gnome-shell --nested --wayland
    } catch {
        print "❌ Nested session failed. Your GNOME version might not support --nested."
        print "   Try running with: test-nested.nu xephyr"
    }
}

def test_xephyr [] {
    if (which Xephyr | is-empty) {
        print "❌ Xephyr not found. Install it first:"
        print "   - NixOS: nix-shell -p xorg.xorgserver"
        print "   - Ubuntu/Debian: sudo apt install xserver-xephyr"
        print "   - Arch: sudo pacman -S xorg-server-xephyr"
        exit 1
    }
    
    print "🚀 Starting Xephyr nested X session..."
    print "   - Extensions directory: /tmp/gnome-shell-test-extensions"
    print "   - Window resolution: 1200x800"
    print "   - Display: :99"
    
    $env.GNOME_SHELL_EXTENSION_DIR = "/tmp/gnome-shell-test-extensions"
    $env.DISPLAY = ":99"
    
    print "🚀 Starting Xephyr session..."
    print "   Please run these commands in separate terminals:"
    print $"   Terminal 1: GNOME_SHELL_EXTENSION_DIR=/tmp/gnome-shell-test-extensions Xephyr :99 -screen 1200x800 -title \"GNOME Shell Extension Test\""
    print $"   Terminal 2: DISPLAY=:99 GNOME_SHELL_EXTENSION_DIR=/tmp/gnome-shell-test-extensions gnome-shell --display=:99 --replace"
    print ""
    print "   After both are running:"
    print "   - Open terminal in Xephyr session"
    print "   - Run: gnome-extensions enable pano@elhan.io"
    print "   - Test your extension"
    
    let continue = (input "Press Enter when you've started both commands and want to continue, or 'q' to quit: ")
    if ($continue | str downcase) == "q" {
        print "❌ Cancelled"
        exit 0
    }
}

def test_restart_shell [] {
    print "🔄 Installing extension to user directory and restarting shell..."
    print "   This will temporarily restart your current GNOME Shell!"
    
    let confirm = (input "Are you sure you want to restart your shell? (y/N): ")
    if ($confirm | str downcase) != "y" {
        print "❌ Cancelled"
        exit 0
    }
    
    # Install to user extensions
    mkdir ~/.local/share/gnome-shell/extensions
    rm -rf ~/.local/share/gnome-shell/extensions/pano@elhan.io
    cp -r dist ~/.local/share/gnome-shell/extensions/pano@elhan.io
    
    print "   Extension installed. Restarting GNOME Shell..."
    print "   Press Alt+F2, type 'r' and press Enter"
    print "   Then enable with: gnome-extensions enable pano@elhan.io"
}

# Show help if called with --help
def "main --help" [] {
    print "GNOME Shell Extension Tester for Pano"
    print ""
    print "Usage: test-nested.nu [method]"
    print ""
    print "Methods:"
    print "  auto    - Automatically choose best method (default)"
    print "  nested  - Use nested Wayland session (GNOME < 49)"
    print "  xephyr  - Use Xephyr X11 nested session"
    print "  restart - Install and restart current shell (risky)"
    print ""
    print "Examples:"
    print "  ./test-nested.nu"
    print "  ./test-nested.nu xephyr"
    print "  ./test-nested.nu nested"
}