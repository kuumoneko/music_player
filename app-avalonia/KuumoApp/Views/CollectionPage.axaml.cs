using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using Avalonia.Media;
using KuumoApp.Services;

namespace KuumoApp.Views;

public partial class CollectionPage : UserControl
{
    private CollectionNav? _nav;

    public CollectionPage()
    {
        InitializeComponent();
        AttachedToVisualTree += (_, _) =>
        {
            if (_nav is not null)
            {
                App.Services.Events.DataChanged += OnDataChanged;
            }
        };
        DetachedFromVisualTree += (_, _) =>
        {
            App.Services.Events.DataChanged -= OnDataChanged;
        };
    }

    public void LoadNav(CollectionNav nav)
    {
        _nav = nav;
        TitleText.Text = nav.Title;
        ShellPage.SetTitle(nav.Title);
        App.Services.Events.DataChanged += OnDataChanged;
        Render();
    }

    private void OnDataChanged(string key)
    {
        if (_nav is { SourceKey.Length: > 0 } nav && nav.SourceKey == key && nav.Reload is not null)
        {
            _ = ReloadAsync();
        }
    }

    private void Render()
    {
        ContentPanel.Children.Clear();
        if (_nav is null || _nav.Cards.Length == 0)
        {
            ContentPanel.Children.Add(new TextBlock { Text = "Nothing here yet." });
            return;
        }
        var availableWidth = Bounds.Width > 32 ? Bounds.Width - 32 : 0;
        var grid = MediaGrid.BuildGrid(_nav.Cards, card =>
        {
            _ = MediaGrid.DefaultOpen(card);
            return System.Threading.Tasks.Task.CompletedTask;
        }, availableWidth);
        ContentPanel.Children.Add(grid);
    }

    private async System.Threading.Tasks.Task ReloadAsync()
    {
        if (_nav?.Reload is null) return;
        try
        {
            var cards = await _nav.Reload();
            _nav = _nav with { Cards = cards };
            Render();
        }
        catch (Exception ex)
        {
            AppLog.Write("collection", $"reload failed: {ex.Message}");
        }
    }
}