
export default function Search(
    { theme,
        search,
        typing,
        setsearch,
        settyping
    }
        :
        {
            theme: string,
            search: boolean,
            typing: string,
            setsearch: (a: boolean) => void,
            settyping: (a: string) => void
        }
) {

    return (
        <div className="search-container" onKeyDown={(e) => {
            if (e.key === "Enter") {
                setsearch(true);
            }
        }}>
            <input type="text"
                className="search-input"
                disabled={search}
                autoComplete='false'
                placeholder={(search) ? "loading..." : "Your link here..."}
                value={typing}
                onChange={(e) => settyping(e.target.value)}
                style={{
                    backgroundColor: (theme == 'dark') ? 'black' : "white",
                    color: (theme == 'dark') ? 'white' : "black"
                }}
            />
            <button className="search-button" onClick={() => {
                setsearch(true);
            }}>
                <span className="material-icons">search</span>
            </button>
        </div>
    )
}