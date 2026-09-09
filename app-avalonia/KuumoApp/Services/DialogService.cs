using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace KuumoApp.Services;

public static class DialogService
{
    public static async Task<bool> ConfirmAsync(string title, string message, Window? owner = null)
    {
        var tcs = new TaskCompletionSource<bool>();
        var window = owner ?? (Application.Current?.ApplicationLifetime is Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime desktop
            ? desktop.MainWindow : null);
        if (window is null)
        {
            tcs.SetResult(false);
            return false;
        }

        var cancelBtn = new Button
        {
            Content = "Cancel",
            Width = 80,
            HorizontalContentAlignment = HorizontalAlignment.Center,
        };
        var okBtn = new Button
        {
            Content = "OK",
            Width = 80,
            HorizontalContentAlignment = HorizontalAlignment.Center,
        };

        var btnPanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Spacing = 8,
            Children = { cancelBtn, okBtn }
        };
        Grid.SetRow(btnPanel, 1);

        var messageBlock = new TextBlock
        {
            Text = message,
            TextWrapping = TextWrapping.Wrap,
            VerticalAlignment = VerticalAlignment.Center,
            FontSize = 14,
        };

        var grid = new Grid
        {
            RowDefinitions = new RowDefinitions("*,Auto"),
            Margin = new Thickness(16),
            Children = { messageBlock, btnPanel }
        };

        var dialog = new Window
        {
            Title = title,
            Width = 400,
            Height = 200,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            CanResize = false,
            ShowInTaskbar = false,
            SystemDecorations = SystemDecorations.Full,
            Content = grid,
        };

        cancelBtn.Click += (_, _) =>
        {
            tcs.TrySetResult(false);
            dialog.Close();
        };
        okBtn.Click += (_, _) =>
        {
            tcs.TrySetResult(true);
            dialog.Close();
        };
        dialog.Closed += (_, _) => tcs.TrySetResult(false);

        await dialog.ShowDialog(window);
        return await tcs.Task;
    }
}