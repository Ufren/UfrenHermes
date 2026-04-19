param(
    [string]$OutputDir = "$PSScriptRoot\..\resources\icons"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("Ufren.IconNativeMethods" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
namespace Ufren {
    public static class IconNativeMethods {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool DestroyIcon(IntPtr hIcon);
    }
}
"@
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function New-RoundedPath {
    param(
        [System.Drawing.RectangleF]$Rect,
        [single]$Radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = [single]($Radius * 2)
    $arc = New-Object System.Drawing.RectangleF($Rect.X, $Rect.Y, $diameter, $diameter)
    $path.AddArc($arc, 180, 90)
    $arc.X = $Rect.Right - $diameter
    $path.AddArc($arc, 270, 90)
    $arc.Y = $Rect.Bottom - $diameter
    $path.AddArc($arc, 0, 90)
    $arc.X = $Rect.Left
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()
    return $path
}

function Get-ThemeStyle {
    param([string]$Theme)
    if ($Theme -eq "light") {
        return @{
            BgStart = [System.Drawing.Color]::FromArgb(255, 220, 238, 255)
            BgEnd = [System.Drawing.Color]::FromArgb(255, 181, 219, 255)
            Panel = [System.Drawing.Color]::FromArgb(235, 248, 252, 255)
            Text = [System.Drawing.Color]::FromArgb(255, 10, 43, 102)
            Border = [System.Drawing.Color]::FromArgb(150, 83, 137, 202)
        }
    }
    return @{
        BgStart = [System.Drawing.Color]::FromArgb(255, 24, 45, 107)
        BgEnd = [System.Drawing.Color]::FromArgb(255, 8, 137, 187)
        Panel = [System.Drawing.Color]::FromArgb(220, 10, 16, 34)
        Text = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
        Border = [System.Drawing.Color]::FromArgb(150, 120, 194, 255)
    }
}

function New-BrandBitmap {
    param(
        [int]$Size,
        [string]$Theme
    )
    $style = Get-ThemeStyle -Theme $Theme
    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::FromArgb(255, 12, 17, 29))

        $backgroundRect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
        $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $backgroundRect,
            $style.BgStart,
            $style.BgEnd,
            45
        )
        try {
            $graphics.FillRectangle($backgroundBrush, $backgroundRect)
        } finally {
            $backgroundBrush.Dispose()
        }

        $padding = [single]([Math]::Round($Size * 0.14))
        $radius = [single]([Math]::Round($Size * 0.12))
        $panelRect = New-Object System.Drawing.RectangleF $padding, $padding, ($Size - ($padding * 2)), ($Size - ($padding * 2))
        $panelPath = New-RoundedPath -Rect $panelRect -Radius $radius
        $panelBrush = New-Object System.Drawing.SolidBrush ($style.Panel)
        $borderPen = [System.Drawing.Pen]::new($style.Border, [single]([Math]::Max(1, [Math]::Round($Size * 0.012))))
        try {
            $graphics.FillPath($panelBrush, $panelPath)
            $graphics.DrawPath($borderPen, $panelPath)
        } finally {
            $panelBrush.Dispose()
            $borderPen.Dispose()
            $panelPath.Dispose()
        }

        $fontName = if ($Theme -eq "light") { "Segoe UI" } else { "Segoe UI Semibold" }
        try {
            $fontFamily = New-Object System.Drawing.FontFamily $fontName
        } catch {
            $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
        }
        $font = [System.Drawing.Font]::new(
            $fontFamily,
            [single]([Math]::Round($Size * 0.44)),
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $textBrush = New-Object System.Drawing.SolidBrush ($style.Text)
        try {
            $text = "H"
            $textSize = $graphics.MeasureString($text, $font)
            $textX = ($Size - $textSize.Width) / 2
            $textY = ($Size - $textSize.Height) / 2 - [single]([Math]::Round($Size * 0.01))
            $graphics.DrawString($text, $font, $textBrush, $textX, $textY)
        } finally {
            $textBrush.Dispose()
            $font.Dispose()
            $fontFamily.Dispose()
        }
        return $bitmap
    } finally {
        $graphics.Dispose()
    }
}

function New-InstallerBitmap {
    param(
        [int]$Width,
        [int]$Height,
        [string]$Theme,
        [string]$Label
    )
    $style = Get-ThemeStyle -Theme $Theme
    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $rect = New-Object System.Drawing.RectangleF 0, 0, $Width, $Height
        $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $rect,
            $style.BgStart,
            $style.BgEnd,
            55
        )
        try {
            $graphics.FillRectangle($backgroundBrush, $rect)
        } finally {
            $backgroundBrush.Dispose()
        }

        $overlayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 6, 15, 33))
        try {
            $graphics.FillRectangle($overlayBrush, 0, 0, $Width, $Height)
        } finally {
            $overlayBrush.Dispose()
        }

        $hSize = [single]([Math]::Round([Math]::Min($Width, $Height) * 0.42))
        $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
        $hFont = [System.Drawing.Font]::new($fontFamily, $hSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $hBrush = New-Object System.Drawing.SolidBrush($style.Text)
        try {
            $hText = "H"
            $hMeasure = $graphics.MeasureString($hText, $hFont)
            $graphics.DrawString($hText, $hFont, $hBrush, [single]10, [single]8)
        } finally {
            $hBrush.Dispose()
            $hFont.Dispose()
        }

        $labelSize = [single]([Math]::Round([Math]::Max(12, [Math]::Min($Width, $Height) * 0.09)))
        $labelFont = [System.Drawing.Font]::new($fontFamily, $labelSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $labelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, $style.Text))
        try {
            $labelMeasure = $graphics.MeasureString($Label, $labelFont)
            $labelX = [single]([Math]::Max(10, $Width - $labelMeasure.Width - 10))
            $labelY = [single]([Math]::Max(10, $Height - $labelMeasure.Height - 8))
            $graphics.DrawString($Label, $labelFont, $labelBrush, $labelX, $labelY)
        } finally {
            $labelBrush.Dispose()
            $labelFont.Dispose()
            $fontFamily.Dispose()
        }
        return $bitmap
    } finally {
        $graphics.Dispose()
    }
}

function New-SvgSource {
    param(
        [string]$Theme,
        [string]$Path
    )
    if ($Theme -eq "light") {
        $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#dceeff"/>
      <stop offset="100%" stop-color="#b5dbff"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#g)"/>
  <rect x="144" y="144" rx="120" ry="120" width="736" height="736" fill="#f8fcff" stroke="#5389ca" stroke-opacity="0.6" stroke-width="14"/>
  <text x="512" y="610" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="470" font-weight="700" fill="#0a2b66">H</text>
</svg>
"@
    } else {
        $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#182d6b"/>
      <stop offset="100%" stop-color="#0889bb"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#g)"/>
  <rect x="144" y="144" rx="120" ry="120" width="736" height="736" fill="#0a1022" fill-opacity="0.86" stroke="#78c2ff" stroke-opacity="0.6" stroke-width="14"/>
  <text x="512" y="610" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="470" font-weight="700" fill="#ffffff">H</text>
</svg>
"@
    }
    Set-Content -Path $Path -Value $svg -Encoding utf8
}

Ensure-Directory -Path $OutputDir
$sourceDir = Join-Path $OutputDir "source"
$variantsDir = Join-Path $OutputDir "variants"
Ensure-Directory -Path $sourceDir
Ensure-Directory -Path $variantsDir

New-SvgSource -Theme "dark" -Path (Join-Path $sourceDir "icon-dark.svg")
New-SvgSource -Theme "light" -Path (Join-Path $sourceDir "icon-light.svg")

$iconPngPath = Join-Path $OutputDir "icon.png"
$iconIcoPath = Join-Path $OutputDir "icon.ico"
$installerDir = Join-Path $OutputDir "installer"
Ensure-Directory -Path $installerDir
$sizes = @(16, 24, 32, 48, 64, 128, 256, 512)
$manifestEntries = @()

foreach ($theme in @("dark", "light")) {
    foreach ($size in $sizes) {
        $bitmap = New-BrandBitmap -Size $size -Theme $theme
        $fileName = "icon-$theme-$size.png"
        $filePath = Join-Path $variantsDir $fileName
        try {
            $bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $bitmap.Dispose()
        }
        $manifestEntries += @{
            theme = $theme
            size = $size
            file = "variants/$fileName"
        }
    }
}

$baseIconPath = Join-Path $variantsDir "icon-dark-256.png"
Copy-Item -LiteralPath $baseIconPath -Destination $iconPngPath -Force

$iconBitmap = [System.Drawing.Bitmap]::FromFile($baseIconPath)
$iconHandle = [IntPtr]::Zero
$icon = $null
try {
    $iconHandle = $iconBitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $fileStream = [System.IO.File]::Open($iconIcoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    try {
        $icon.Save($fileStream)
    } finally {
        $fileStream.Dispose()
    }
} finally {
    if ($icon -ne $null) {
        $icon.Dispose()
    }
    if ($iconHandle -ne [IntPtr]::Zero) {
        [Ufren.IconNativeMethods]::DestroyIcon($iconHandle) | Out-Null
    }
    $iconBitmap.Dispose()
}

$manifest = @{
    generatedAt = (Get-Date).ToString("o")
    defaultIcon = @{
        png = "icon.png"
        ico = "icon.ico"
    }
    sources = @("source/icon-dark.svg", "source/icon-light.svg")
    variants = $manifestEntries
    installerAssets = @(
        "installer/installer-sidebar.bmp",
        "installer/uninstaller-sidebar.bmp",
        "installer/installer-header.bmp"
    )
}
$manifestPath = Join-Path $OutputDir "manifest.json"
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding utf8

$installerSidebarPath = Join-Path $installerDir "installer-sidebar.bmp"
$uninstallerSidebarPath = Join-Path $installerDir "uninstaller-sidebar.bmp"
$installerHeaderPath = Join-Path $installerDir "installer-header.bmp"

$installerSidebar = New-InstallerBitmap -Width 164 -Height 314 -Theme "dark" -Label "Ufren Hermes"
try {
    $installerSidebar.Save($installerSidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
    $installerSidebar.Dispose()
}

$uninstallerSidebar = New-InstallerBitmap -Width 164 -Height 314 -Theme "light" -Label "Ufren Hermes"
try {
    $uninstallerSidebar.Save($uninstallerSidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
    $uninstallerSidebar.Dispose()
}

$installerHeader = New-InstallerBitmap -Width 150 -Height 57 -Theme "dark" -Label "Setup"
try {
    $installerHeader.Save($installerHeaderPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
    $installerHeader.Dispose()
}

Write-Output "Icon assets generated:"
Write-Output "  - $iconPngPath"
Write-Output "  - $iconIcoPath"
Write-Output "  - $manifestPath"
Write-Output "  - $variantsDir (multi-size PNG variants)"
Write-Output "  - $sourceDir (editable SVG sources)"
Write-Output "  - $installerDir (NSIS header/sidebar bitmaps)"
