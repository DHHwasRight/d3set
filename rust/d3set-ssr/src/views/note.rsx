pub fn Note(paragraphs: &[String]) -> Element {
    <>
        for p in paragraphs {
            <p>{p}</p>
        }
    </>
}
