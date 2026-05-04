export function AttributionFooter() {
  return (
    <footer
      className="attribution-footer"
      role="contentinfo"
      aria-label="Data attribution and licence"
    >
      <p>
        <strong>Oireachtas Explorer</strong> is an unofficial project and is not
        affiliated with, endorsed by, or connected to the Houses of the Oireachtas.
      </p>
      <p>
        Parliamentary data is sourced from the{' '}
        <a
          href="https://api.oireachtas.ie/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Oireachtas Open Data API
        </a>
        {' '}&copy; Houses of the Oireachtas, reused under the{' '}
        <a
          href="https://www.oireachtas.ie/en/open-data/license/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Oireachtas (Open Data) PSI Licence
        </a>
        {' '}incorporating the{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Creative Commons Attribution 4.0 International Licence
        </a>
        . Official records are available at{' '}
        <a
          href="https://www.oireachtas.ie/"
          target="_blank"
          rel="noopener noreferrer"
        >
          oireachtas.ie
        </a>
        .
      </p>
      <p>
        Data shown here has been reformatted, filtered, and paginated for
        display; it may not reflect the complete or most current official record.
      </p>
      <p className="attribution-footer__disclaimer">
        The data is provided &ldquo;as-is&rdquo; without warranties of any kind,
        express or implied, to the fullest extent permitted by the Oireachtas
        licence and applicable law.
      </p>
      <p className="attribution-footer__contact">
        Contact: <a href="mailto:info@oireachtas-explorer.ie">info@oireachtas-explorer.ie</a>
      </p>
    </footer>
  );
}
