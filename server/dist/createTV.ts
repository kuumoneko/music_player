export default async function get_vistorId(): Promise<string> {
    const res = await fetch(`https://www.youtube.com/watch?v=rLSWkDB3P3Q&hl=en&bpctr=${Math.ceil(Date.now() / 1000)}&has_verified=1`);
    const data = await res.text();

    const tempping = data.split("var ytInitialPlayerResponse = ")[1].split(";</script>")[0];

    return (JSON.parse(tempping).responseContext.serviceTrackingParams as any[]).find((x: any) => { return x.service === "GFEEDBACK" }).params.find((x: any) => { return x.key === "visitor_data" }).value
}