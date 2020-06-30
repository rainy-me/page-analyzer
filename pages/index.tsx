import { useState } from "react";

export default function Index() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState("");
  const [fetching, setFetching] = useState(false);

  const handleFetch = async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const res: any = await fetch(
        `https://e85qx3bjrb.execute-api.us-east-1.amazonaws.com/dev/analyze?url=${url}`
      ).then((res) => res.json());
      if (res?.img) {
        setData(res.img);
        setFetching(false);
      }
    } catch {
      setFetching(false);
    }
  };

  return (
    <div>
      <input
        value={url}
        type="text"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFetch();
        }}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFetch();
        }}
      >
        get
      </button>
      {fetching && <p>this may take serveral minutes</p>}
      <img src={data} alt="" />
    </div>
  );
}
