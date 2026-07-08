import { requireAdmin } from '@/lib/server/rbac';

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { source, query } = await req.json();

    if (!source || !query) {
      return Response.json(
        { error: 'source and query parameters are required' },
        { status: 400 }
      );
    }

    // Validate source
    const validSources = [
      'github',
      'twitter',
      'stackoverflow',
      'youtube',
      'rss',
      'linkedin',
    ];
    if (!validSources.includes(source)) {
      return Response.json(
        { error: 'Invalid source. Valid sources: ' + validSources.join(', ') },
        { status: 400 }
      );
    }

    // Agent Reach integration
    // This is a placeholder implementation that returns mock results
    // In production, this would call the actual Agent Reach CLI or API

    // For now, return mock data with a note about Agent Reach availability
    const mockResults = [
      {
        title: 'Agent Reach integration pending',
        summary:
          'Agent Reach CLI integration is available but requires explicit installation and configuration.',
        url: 'https://github.com/Panniantong/agent-reach',
        tags: ['experimental', 'integration-pending'],
        source: source,
      },
      {
        title: `Searched ${source} for: "${query}"`,
        summary:
          'To enable live Agent Reach queries, install the CLI tool and configure the backend integration.',
        url: 'https://docs.example.com/agent-reach',
        tags: ['documentation', 'setup'],
        source: source,
      },
    ];

    // If Agent Reach CLI is installed and configured, uncomment and use:
    // const { execSync } = require('child_process');
    // try {
    //   const result = execSync(`agent-reach ${source} "${query}"`, {
    //     encoding: 'utf-8',
    //   });
    //   // Parse result and return
    // } catch (err) {
    //   // Fall back to mock results
    // }

    return Response.json({ results: mockResults });
  } catch (error) {
    console.error('Agent Reach error:', error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process Agent Reach query',
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500 }
    );
  }
}
