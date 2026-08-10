using KuumoApp.Models;
using KuumoApp.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace KuumoApp.Views;

public sealed partial class CollectionPage : Page
{
    private CollectionNav? _nav;

    public CollectionPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        _nav = e.Parameter as CollectionNav;
        ShellPage.SetTitle(_nav?.Title);
        App.Services.Events.DataChanged += OnDataChanged;
        Render();
    }

    protected override void OnNavigatedFrom(NavigationEventArgs e)
    {
        base.OnNavigatedFrom(e);
        App.Services.Events.DataChanged -= OnDataChanged;
        _nav = null;
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
        Root.Children.Clear();
        if (_nav is null || _nav.Cards.Length == 0)
        {
            Root.Children.Add(new TextBlock { Text = "Nothing here yet." });
            return;
        }
        Root.Children.Add(new TextBlock
        {
            Text = _nav.Title,
            FontSize = 24,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
        });
        Root.Children.Add(MediaGrid.BuildGrid(_nav.Cards, MediaGrid.DefaultOpen));
    }

    private async Task ReloadAsync()
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
