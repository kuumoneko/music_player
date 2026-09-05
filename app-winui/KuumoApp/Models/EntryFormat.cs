namespace KuumoApp.Models;

public static class EntryFormat
{
    public static string Build(string source, string type, string id) => $"{source}:{type}:{id}";

    public static bool TryParse(string entry, out string source, out string type, out string id)
    {
        source = "";
        type = "";
        id = "";
        if (string.IsNullOrEmpty(entry))
        {
            return false;
        }
        var parts = entry.Split(':');
        if (parts.Length != 3 || parts[0].Length == 0 || parts[1].Length == 0 || parts[2].Length == 0)
        {
            return false;
        }
        source = parts[0];
        type = parts[1];
        id = parts[2];
        return true;
    }

    public static (string Source, string Type, string Id) Parse(string entry)
    {
        if (!TryParse(entry, out var source, out var type, out var id))
        {
            throw new FormatException($"Invalid entry format: {entry}");
        }
        return (source, type, id);
    }
}
